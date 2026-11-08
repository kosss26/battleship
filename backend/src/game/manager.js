import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import { config } from '../config.js'
import { GameRoom, botProfile } from './room.js'
import { CAMPAIGN, AI_DIFFICULTIES } from './constants.js'
import { getUser, publicProfile, mutateUser, selfView, GameError, displayName } from '../services/users.js'
import { areFriends } from '../services/friends.js'
import { notifyById } from '../services/notify.js'
import { persistRoom, savedRooms, latestResult, settleRoom, dismissResult, pruneSavedRooms, readSavedRoom, savedRoomForUser } from './persistence.js'
import { deliverMatchNotifications } from '../services/match.js'
export { RANKED_GUARD } from './persistence.js'
import { tx } from '../db.js'
import { trackActivity } from '../services/analytics.js'

const rooms = new Map() // roomId -> GameRoom
const userRoom = new Map() // userId -> roomId
const queue = new Map() // userId -> { rating, games, since, profile }
const duels = new Map() // code -> { hostId, createdAt, profile }
const joinAttempts = new Map() // userId -> [timestamps of failed duel joins]
const online = new Map() // userId -> number of open sockets
const inviteSent = new Map() // `${from}:${to}` -> timestamp (anti-spam)

let io = null
let draining = false
let tickRunning = false
const intervals = []
const operations = new Set()
const finalizing = new Map()
const reservedUsers = new Set()

const emit = (userId, event, payload) => io?.to(`u:${userId}`).emit(event, payload)

/** Online / in-game status for the friends list */
export const presence = (userId) => ({
  online: (online.get(userId) || 0) > 0,
  inGame: !!activeRoom(userId),
})
export const isOnline = (userId) => (online.get(userId) || 0) > 0

export const stats = () => ({ rooms: rooms.size, queue: queue.size, duels: duels.size, online: io?.engine.clientsCount || 0 })

function activeRoom(userId) {
  const id = userRoom.get(userId)
  const room = id && rooms.get(id)
  if (room && room.phase !== 'over') return room
  return null
}

const hooks = {
  emit,
  transaction: tx, persist: persistRoom,
  load: readSavedRoom, connected: isOnline,
  onFinish: (room) => finalize(room).catch(e => console.error('[finalize]', room.id, e.message)),
}

async function createRoom(opts) {
  const ids = opts.seats.filter(s => s.kind === 'human').map(s => s.userId)
  if (ids.some(id => reservedUsers.has(id))) throw new GameError('already_in_game')
  ids.forEach(id => reservedUsers.add(id))
  const room = new GameRoom({ ...opts, hooks })
  try { await room.run(() => {}) } catch (e) {
    if (!(await readSavedRoom(room.id).catch(() => null))) { room.dispose(); throw e }
  }
  finally { ids.forEach(id => reservedUsers.delete(id)) }
  rooms.set(room.id, room)
  for (const s of room.humans()) userRoom.set(s.userId, room.id)
  room.broadcast()
  return room
}

function closeRoom(room) {
  room.dispose()
  rooms.delete(room.id)
  for (const s of room.humans()) if (userRoom.get(s.userId) === room.id) userRoom.delete(s.userId)
}

/* ───────── finishing ───────── */

function outcome(room, userId, result) {
  const i = room.seatOf(userId)
  return { state: room.snapshot(i), won: room.result.winnerSeat === i, reason: room.result.reason,
    durationMs: result.durationMs, rewards: result.rewards[i]?.summary || null,
    extra: result.rewards[i]?.extra || null, myStats: room.seatStats(i), oppStats: room.seatStats(1-i) }
}

async function finalize(room) {
  if (finalizing.has(room.id)) return finalizing.get(room.id)
  const task = (async () => {
    const result = await settleRoom(room)
    room.settled = true
    room.completion = result
    for (const seat of room.humans()) {
      const fresh = await getUser(seat.userId).catch(() => null)
      if (fresh) emit(seat.userId, 'profile', selfView(fresh))
      emit(seat.userId, 'game:over', outcome(room, seat.userId, result))
    }
    deliverMatchNotifications().catch(e => console.error('[match-notify]', e.message))
    const cleanup = setTimeout(() => closeRoom(room), room.mode === 'duel' ? 120_000 : 5_000)
    cleanup.unref()
    if (room.mode !== 'duel') for (const s of room.humans()) {
      if (userRoom.get(s.userId) === room.id) userRoom.delete(s.userId)
    }
  })()
  finalizing.set(room.id, task)
  try { return await task } finally { finalizing.delete(room.id) }
}

export async function restoreGames() {
  draining = false
  await pruneSavedRooms()
  for (const row of await savedRooms()) {
    const room = new GameRoom({ ...row.state, hooks, restored: row.state })
    rooms.set(room.id, room)
    for (const s of room.humans()) userRoom.set(s.userId, room.id)
    if (room.phase === 'over') await finalize(room)
    else room.recover(new Date(row.updated_at).getTime())
  }
}

async function recoverUserRoom(userId) {
  const saved = await savedRoomForUser(userId)
  if (!saved) return null
  let room = rooms.get(saved.id)
  if (!room) {
    room = new GameRoom({ ...saved.state, restored: saved.state, hooks })
    rooms.set(room.id, room)
    for (const seat of room.humans()) userRoom.set(seat.userId, room.id)
    room.recover(new Date(saved.updated_at).getTime())
  }
  if (room.phase !== 'over') await room.run(() => {
    for (const seat of room.humans()) if (isOnline(seat.userId)) room.reconnected(seat.userId)
  })
  return room
}

export async function stopGames() {
  draining = true
  for (const t of intervals.splice(0)) clearInterval(t)
  await Promise.allSettled([...operations])
  for (const r of rooms.values()) r.dispose()
  await Promise.allSettled([...rooms.values()].map(r => r.work))
  for (const r of rooms.values()) r.dispose()
  await Promise.allSettled([...finalizing.values()])
  rooms.clear(); userRoom.clear(); queue.clear(); duels.clear(); online.clear(); reservedUsers.clear()
}

/* ───────── matchmaking ───────── */

async function matchmakingTick() {
  if (draining || tickRunning) return
  tickRunning = true
  try {
  const now = Date.now()
  const entries = [...queue.entries()].sort((a, b) => a[1].since - b[1].since)
  const taken = new Set()
  for (const [idA, a] of entries) {
    if (taken.has(idA)) continue
    const windowA = 100 + ((now - a.since) / 1000) * 25
    let best = null
    for (const [idB, b] of entries) {
      if (idB === idA || taken.has(idB)) continue
      const windowB = 100 + ((now - b.since) / 1000) * 25
      const diff = Math.abs(a.rating - b.rating)
      if (diff <= Math.min(Math.max(windowA, windowB), 600) && (!best || diff < best.diff)) best = { idB, b, diff }
    }
    if (best) {
      taken.add(idA)
      taken.add(best.idB)
      queue.delete(idA)
      queue.delete(best.idB)
      let room
      try { room = await createRoom({
        mode: 'ranked',
        seats: [
          { kind: 'human', userId: idA, profile: a.profile, rankedGames: a.games },
          { kind: 'human', userId: best.idB, profile: best.b.profile, rankedGames: best.b.games },
        ],
      }) } catch (e) {
        for (const [id, entry] of [[idA, a], [best.idB, best.b]]) if (!activeRoom(id)) queue.set(id, entry)
        throw e
      }
      emit(idA, 'mm:found', { roomId: room.id, opponent: best.b.profile })
      emit(best.idB, 'mm:found', { roomId: room.id, opponent: a.profile })
    }
  }
  for (const [id, a] of queue) emit(id, 'mm:status', { waitingMs: now - a.since, inQueue: queue.size })
  } finally { tickRunning = false }
}

/* ───────── socket ───────── */

const ack = (cb, payload) => typeof cb === 'function' && cb(payload)

export function initSockets(server) {
  io = server
  intervals.push(setInterval(() => {
    const task = matchmakingTick().catch(e => console.error('[matchmaking]', e.message))
    operations.add(task); task.finally(() => operations.delete(task))
  }, 1000).unref())
  intervals.push(setInterval(() => {
    for (const r of rooms.values()) if (r.phase === 'over' && !r.settled) hooks.onFinish(r)
  }, 5000).unref())
  intervals.push(setInterval(() => pruneSavedRooms().catch(e => console.error('[room-prune]', e.message)), 3600_000).unref())
  intervals.push(setInterval(() => {
    const now = Date.now()
    for (const [code, d] of duels) if (now - d.createdAt > 30 * 60_000) duels.delete(code)
    joinAttempts.clear()
    for (const [k, t] of inviteSent) if (now - t > 60_000) inviteSent.delete(k)
  }, 60_000).unref())

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token
      const payload = jwt.verify(token, config.jwtSecret)
      socket.userId = Number(payload.uid)
      const u = await getUser(socket.userId)
      if (!u) return next(new Error('unauthorized'))
      if (u.banned) return next(new Error('banned'))
      next()
    } catch {
      next(new Error('unauthorized'))
    }
  })

  io.on('connection', async (socket) => {
    const userId = socket.userId
    socket.join(`u:${userId}`)
    online.set(userId, (online.get(userId) || 0) + 1)
    trackActivity(userId)

    const connectedRoom = activeRoom(userId)
    if (connectedRoom) connectedRoom.run(() => connectedRoom.reconnected(userId)).catch(e => console.error('[reconnect]', e.message))

    const loadProfile = async () => {
      const u = await getUser(userId)
      if (!u) throw new GameError('user_not_found')
      if (u.banned) throw new GameError('banned')
      return u
    }

    const guard = (handler) => async (data = {}, cb) => {
      try {
        if (draining) throw new GameError('server_restarting', 503)
        const task = Promise.resolve().then(() => handler(data || {}))
        operations.add(task)
        let res
        try { res = await task } finally { operations.delete(task) }
        ack(cb, res ?? { ok: true })
      } catch (e) {
        if (!(e instanceof GameError)) console.error('[socket]', e)
        ack(cb, { error: e.code || 'server_error' })
      }
    }

    const ensureFree = async () => {
      if (!userRoom.has(userId) && !reservedUsers.has(userId)) await recoverUserRoom(userId)
      const previous = rooms.get(userRoom.get(userId))
      if (reservedUsers.has(userId) || (previous && (previous.phase !== 'over' || !previous.settled))) throw new GameError('already_in_game')
      queue.delete(userId)
    }

    socket.on('game:resume', guard(async () => {
      const r = activeRoom(userId) || await recoverUserRoom(userId)
      if (r && r.phase !== 'over') { await r.run(() => r.reconnected(userId)); return { room: r.id } }
      const pending = rooms.get(userRoom.get(userId))
      if (pending && !pending.settled) { await finalize(pending); return { room: pending.id } }
      const row = await latestResult(userId)
      if (row) {
        const finished = new GameRoom({ ...row.state, hooks, restored: row.state })
        emit(userId, 'game:over', outcome(finished, userId, row.settlement))
      }
      return { room: null }
    }))

    socket.on('ai:start', guard(async ({ difficulty, level, demoFleet }) => {
      if (demoFleet != null && (demoFleet !== 'regent' || level != null)) throw new GameError('bad_demo')
      await ensureFree()
      const u = await loadProfile()
      let mode = 'ai'
      let diff = difficulty
      if (level != null) {
        const lvl = CAMPAIGN.find((l) => l.n === Number(level))
        if (!lvl) throw new GameError('bad_level')
        if (lvl.n > 1 && !u.data.campaign[lvl.n - 1]) throw new GameError('level_locked')
        mode = 'campaign'
        diff = lvl.ai
      } else if (!AI_DIFFICULTIES.includes(diff)) throw new GameError('bad_difficulty')
      const bot = botProfile(diff, u.language)
      if (mode === 'campaign') bot.name = `${bot.name} · ${level}`
      const r = await createRoom({
        mode,
        demoFleet,
        difficulty: mode === 'ai' ? diff : null,
        level: mode === 'campaign' ? Number(level) : null,
        mods: mode === 'campaign' ? CAMPAIGN.find((l) => l.n === Number(level)).mods : {},
        seats: [{ kind: 'human', userId, profile: publicProfile(u) }, { kind: 'bot', profile: bot }],
      })
      return { room: r.id }
    }))

    socket.on('mm:join', guard(async () => {
      await ensureFree()
      const u = await loadProfile()
      queue.set(userId, { rating: u.rating, games: u.data.stats.pvpGames, since: Date.now(), profile: publicProfile(u) })
      return { ok: true }
    }))

    socket.on('mm:leave', guard(async () => {
      queue.delete(userId)
    }))

    const openDuel = async () => {
      await ensureFree()
      const u = await loadProfile()
      for (const [c, d] of duels) {
        if (d.hostId === userId) {
          clearTimeout(d.closing)
          d.closing = null
          d.createdAt = Date.now()
          return { code: c, profile: d.profile, user: u }
        }
      }
      let code
      do code = String(crypto.randomInt(10000, 100000))
      while (duels.has(code))
      duels.set(code, { hostId: userId, createdAt: Date.now(), profile: publicProfile(u) })
      return { code, profile: publicProfile(u), user: u }
    }

    socket.on('duel:invite', guard(async ({ friendId }) => {
      const fid = Number(friendId)
      if (!(await areFriends(userId, fid))) throw new GameError('not_friends')
      const key = `${userId}:${fid}`
      if (Date.now() - (inviteSent.get(key) || 0) < 15_000) throw new GameError('invite_cooldown')
      if (activeRoom(fid)) throw new GameError('friend_in_game')
      const { code, profile, user } = await openDuel()
      duels.get(code).invited = fid
      inviteSent.set(key, Date.now())
      emit(fid, 'duel:invite', { code, from: profile })
      if (!isOnline(fid)) notifyById(fid, 'duel_invite', { from: displayName(user), code }, { startParam: `duel_${code}` })
      return { code }
    }))

    socket.on('duel:decline', guard(async ({ code }) => {
      const d = duels.get(String(code || ''))
      if (d && d.invited === userId) emit(d.hostId, 'duel:declined', { userId })
    }))

    socket.on('duel:create', guard(async () => {
      const { code } = await openDuel()
      return { code }
    }))

    // Cancelling is deferred: if the host's screen re-opens the duel right away
    // (remount, quick back/forward), the same code — already sent to a friend — stays valid.
    socket.on('duel:cancel', guard(async () => {
      for (const [c, d] of duels) {
        if (d.hostId !== userId) continue
        clearTimeout(d.closing)
        d.closing = setTimeout(() => {
          if (duels.get(c) === d) duels.delete(c)
        }, 3000)
      }
    }))

    socket.on('duel:join', guard(async ({ code }) => {
      const key = String(code || '').replace(/\D/g, '')
      // Throttle wrong guesses so short numeric codes cannot be brute-forced
      const now = Date.now()
      const attempts = (joinAttempts.get(userId) || []).filter((t) => now - t < 60_000)
      if (attempts.length >= 10) throw new GameError('too_many_attempts')
      const duel = duels.get(key)
      if (!duel) {
        attempts.push(now)
        joinAttempts.set(userId, attempts)
        throw new GameError('duel_not_found')
      }
      if (duel.hostId === userId) return { hosting: true }
      await ensureFree()
      if (activeRoom(duel.hostId)) throw new GameError('host_busy')
      const u = await loadProfile()
      clearTimeout(duel.closing)
      duels.delete(key)
      const r = await createRoom({
        mode: 'duel',
        duelCode: key,
        seats: [
          { kind: 'human', userId: duel.hostId, profile: duel.profile },
          { kind: 'human', userId, profile: publicProfile(u) },
        ],
      })
      return { room: r.id, opponent: duel.profile }
    }))

    socket.on('game:rematch', guard(async () => {
      const r = rooms.get(userRoom.get(userId))
      if (!r || r.phase !== 'over' || r.mode !== 'duel') throw new GameError('no_rematch')
      if (!r.settled) await finalize(r)
      r.rematch.add(userId)
      const other = r.humans().find((s) => s.userId !== userId)
      if (!other) throw new GameError('no_rematch')
      if (!r.rematch.has(other.userId)) {
        emit(other.userId, 'game:rematch', { requested: true })
        return { waiting: true }
      }
      if (activeRoom(other.userId)) throw new GameError('host_busy')
      const [a, b] = await Promise.all([getUser(r.seats[0].userId), getUser(r.seats[1].userId)])
      closeRoom(r)
      const nr = await createRoom({
        mode: 'duel',
        duelCode: r.duelCode,
        seats: [
          { kind: 'human', userId: b.id, profile: publicProfile(b) },
          { kind: 'human', userId: a.id, profile: publicProfile(a) },
        ],
      })
      return { room: nr.id }
    }))

    socket.on('game:place', guard(async ({ ships }) => {
      const r = activeRoom(userId)
      if (!r) throw new GameError('no_game')
      const res = await r.run(() => r.place(userId, ships))
      if (res.error) throw new GameError(res.error)
    }))

    socket.on('game:fire', guard(async ({ r: row, c }) => {
      const r = activeRoom(userId)
      if (!r) throw new GameError('no_game')
      const res = await r.run(() => r.fire(userId, row, c))
      if (res.error) throw new GameError(res.error)
    }))

    socket.on('game:booster', guard(async ({ type, r: row, c }) => {
      const r = activeRoom(userId)
      if (!r) throw new GameError('no_game')
      const res = await r.run(client => r.useBooster(userId, type, row, c, async (t) => {
        const { user } = await mutateUser(userId, (u) => {
          if (!(u.data.boosters[t] > 0)) throw new GameError('no_booster')
          u.data.boosters[t]--
        }, client)
        r.emitTo(r.seats[r.seatOf(userId)], 'profile', selfView(user))
      }))
      if (res.error) throw new GameError(res.error)
    }))

    socket.on('game:emote', guard(async ({ emote }) => {
      activeRoom(userId)?.emote(userId, emote)
    }))

    socket.on('game:resign', guard(async () => {
      const r = activeRoom(userId)
      if (r) await r.run(() => r.resign(userId))
    }))

    socket.on('game:leave', guard(async ({ roomId }) => {
      const r = rooms.get(userRoom.get(userId))
      const id = roomId || (r?.phase === 'over' ? r.id : null)
      if (id && /^[0-9a-f-]{36}$/i.test(id)) await dismissResult(userId, id)
      if (r && r.phase === 'over') userRoom.delete(userId)
    }))

    socket.on('disconnect', async () => {
      if (draining) return
      const n = (online.get(userId) || 1) - 1
      if (n > 0) online.set(userId, n)
      else online.delete(userId)
      const sockets = await io.in(`u:${userId}`).fetchSockets()
      if (draining) return
      if (sockets.length) return
      queue.delete(userId)
      const r = activeRoom(userId)
      if (r) r.run(() => r.disconnected(userId)).catch(e => console.error('[disconnect]', e.message))
    })
  })
}

/** Ends the user's session: resigns an active game, drops them from queues and disconnects */
export async function kickUser(userId) {
  queue.delete(userId)
  for (const [c, d] of duels) if (d.hostId === userId) duels.delete(c)
  const r = rooms.get(userRoom.get(userId))
  if (r && r.phase !== 'over') await r.run(() => r.resign(userId))
  if (r?.phase === 'over' && !r.settled) await finalize(r)
  io?.in(`u:${userId}`).disconnectSockets(true)
}

export const emitToUser = (userId, event, payload) => emit(userId, event, payload)

export function notifyProfile(userId, profile) {
  emit(userId, 'profile', profile)
}
