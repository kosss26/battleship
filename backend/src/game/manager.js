import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import { config } from '../config.js'
import { GameRoom, botProfile } from './room.js'
import { CAMPAIGN, AI_DIFFICULTIES } from './constants.js'
import { getUser, publicProfile, mutateUser, selfView, GameError, displayName } from '../services/users.js'
import { areFriends } from '../services/friends.js'
import { notifyById } from '../services/notify.js'
import { applyMatchResult, saveGame } from '../services/match.js'
import { query } from '../db.js'
import { eloDelta } from '../services/elo.js'

const rooms = new Map() // roomId -> GameRoom
const userRoom = new Map() // userId -> roomId
const queue = new Map() // userId -> { rating, games, since, profile }
const duels = new Map() // code -> { hostId, createdAt, profile }
const joinAttempts = new Map() // userId -> [timestamps of failed duel joins]
const online = new Map() // userId -> number of open sockets
const inviteSent = new Map() // `${from}:${to}` -> timestamp (anti-spam)

let io = null

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
  onFinish: (room) => finalize(room).catch((e) => console.error('[finalize]', e)),
}

function createRoom(opts) {
  const room = new GameRoom({ ...opts, hooks })
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

async function finalize(room) {
  const { winnerSeat, reason } = room.result
  const durationMs = Date.now() - (room.startedAt || room.createdAt)
  const deltas = [0, 0]
  // Matches abandoned during placement count only for ranked/duel forfeits
  const played = room.startedAt !== null

  let ratingNote = null
  if (room.mode === 'ranked' && played) {
    const [a, b] = room.seats
    deltas[0] = eloDelta(a.profile.rating, b.profile.rating, winnerSeat === 0 ? 1 : 0, a.rankedGames)
    deltas[1] = eloDelta(b.profile.rating, a.profile.rating, winnerSeat === 1 ? 1 : 0, b.rankedGames)
    ratingNote = await rankedGuard(room, winnerSeat, reason)
    if (ratingNote === 'repeat_opponent') {
      deltas[0] = 0
      deltas[1] = 0
    } else if (ratingNote === 'early_forfeit') {
      deltas[winnerSeat] = 0 // the quitter still loses rating, the winner gains nothing
    }
  }

  const rewards = await Promise.all(room.seats.map(async (seat, i) => {
    if (seat.kind !== 'human' || !played) return null
    try {
      const { user, summary, extra } = await applyMatchResult(seat.userId, {
        mode: room.mode,
        difficulty: room.mode === 'campaign' ? CAMPAIGN.find((l) => l.n === room.level)?.ai : room.difficulty,
        level: room.level,
        won: winnerSeat === i,
        reason,
        ratingDelta: deltas[i],
        ratingNote,
        ...room.seatStats(i),
      })
      emit(seat.userId, 'profile', selfView(user))
      return { summary, extra }
    } catch (e) {
      console.error('[rewards]', e.message)
      return null
    }
  }))

  room.seats.forEach((seat, i) => {
    if (seat.kind !== 'human') return
    emit(seat.userId, 'game:over', {
      state: room.snapshot(i),
      won: winnerSeat === i,
      reason,
      durationMs,
      rewards: rewards[i]?.summary || null,
      extra: rewards[i]?.extra || null,
      myStats: room.seatStats(i),
      oppStats: room.seatStats(1 - i),
    })
  })

  if (played) {
    const humanId = (i) => (room.seats[i].kind === 'human' ? room.seats[i].userId : null)
    await saveGame({
      id: room.id,
      mode: room.mode,
      difficulty: room.difficulty || (room.level ? `L${room.level}` : null),
      p1: humanId(0),
      p2: humanId(1),
      winner: humanId(winnerSeat),
      winnerSlot: winnerSeat,
      reason,
      p1Delta: deltas[0],
      p2Delta: deltas[1],
      shots: room.moves.length,
      durationMs,
      moves: room.moves,
    })
  }

  // Keep the finished room briefly so duel players can ask for a rematch
  setTimeout(() => closeRoom(room), room.mode === 'duel' ? 120_000 : 5_000)
  for (const s of room.humans()) if (room.mode !== 'duel') userRoom.delete(s.userId)
}

/* ───────── rating anti-abuse ───────── */

export const RANKED_GUARD = { maxGamesPerPairPerDay: 3, minShotsForForfeitWin: 12 }

/**
 * Detects rating farming between two accounts:
 *  - repeat_opponent: the same pair already played N ranked games in the last 24h
 *  - early_forfeit: the match ended by resign/disconnect/timeout almost immediately
 */
async function rankedGuard(room, winnerSeat, reason) {
  const [a, b] = room.seats.map((s) => s.userId)
  try {
    const { rows } = await query(
      `SELECT count(*)::int AS n FROM games WHERE mode = 'ranked' AND ended_at > now() - interval '24 hours'
         AND ((p1 = $1 AND p2 = $2) OR (p1 = $2 AND p2 = $1))`,
      [a, b],
    )
    if (rows[0].n >= RANKED_GUARD.maxGamesPerPairPerDay) return 'repeat_opponent'
  } catch (e) {
    console.error('[rankedGuard]', e.message)
  }
  if (reason !== 'victory' && room.moves.length < RANKED_GUARD.minShotsForForfeitWin) return 'early_forfeit'
  return null
}

/* ───────── matchmaking ───────── */

function matchmakingTick() {
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
      const room = createRoom({
        mode: 'ranked',
        seats: [
          { kind: 'human', userId: idA, profile: a.profile, rankedGames: a.games },
          { kind: 'human', userId: best.idB, profile: best.b.profile, rankedGames: best.b.games },
        ],
      })
      emit(idA, 'mm:found', { roomId: room.id, opponent: best.b.profile })
      emit(best.idB, 'mm:found', { roomId: room.id, opponent: a.profile })
    }
  }
  for (const [id, a] of queue) emit(id, 'mm:status', { waitingMs: now - a.since, inQueue: queue.size })
}

/* ───────── socket ───────── */

const ack = (cb, payload) => typeof cb === 'function' && cb(payload)

export function initSockets(server) {
  io = server
  setInterval(matchmakingTick, 1000).unref()
  setInterval(() => {
    const now = Date.now()
    for (const [code, d] of duels) if (now - d.createdAt > 30 * 60_000) duels.delete(code)
    joinAttempts.clear()
    for (const [k, t] of inviteSent) if (now - t > 60_000) inviteSent.delete(k)
  }, 60_000).unref()

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

    activeRoom(userId)?.reconnected(userId)

    const loadProfile = async () => {
      const u = await getUser(userId)
      if (!u) throw new GameError('user_not_found')
      if (u.banned) throw new GameError('banned')
      return u
    }

    const guard = (handler) => async (data = {}, cb) => {
      try {
        const res = await handler(data || {})
        ack(cb, res ?? { ok: true })
      } catch (e) {
        if (!(e instanceof GameError)) console.error('[socket]', e)
        ack(cb, { error: e.code || 'server_error' })
      }
    }

    const ensureFree = () => {
      if (activeRoom(userId)) throw new GameError('already_in_game')
      queue.delete(userId)
    }

    socket.on('game:resume', guard(async () => {
      const r = activeRoom(userId)
      if (!r) return { room: null }
      r.reconnected(userId)
      return { room: r.id }
    }))

    socket.on('ai:start', guard(async ({ difficulty, level }) => {
      ensureFree()
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
      const r = createRoom({
        mode,
        difficulty: mode === 'ai' ? diff : null,
        level: mode === 'campaign' ? Number(level) : null,
        seats: [{ kind: 'human', userId, profile: publicProfile(u) }, { kind: 'bot', profile: bot }],
      })
      return { room: r.id }
    }))

    socket.on('mm:join', guard(async () => {
      ensureFree()
      const u = await loadProfile()
      queue.set(userId, { rating: u.rating, games: u.data.stats.pvpGames, since: Date.now(), profile: publicProfile(u) })
      return { ok: true }
    }))

    socket.on('mm:leave', guard(async () => {
      queue.delete(userId)
    }))

    const openDuel = async () => {
      ensureFree()
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
      ensureFree()
      if (activeRoom(duel.hostId)) throw new GameError('host_busy')
      const u = await loadProfile()
      clearTimeout(duel.closing)
      duels.delete(key)
      const r = createRoom({
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
      const nr = createRoom({
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
      const res = r.place(userId, ships)
      if (res.error) throw new GameError(res.error)
    }))

    socket.on('game:fire', guard(async ({ r: row, c }) => {
      const r = activeRoom(userId)
      if (!r) throw new GameError('no_game')
      const res = r.fire(userId, row, c)
      if (res.error) throw new GameError(res.error)
    }))

    socket.on('game:booster', guard(async ({ type, r: row, c }) => {
      const r = activeRoom(userId)
      if (!r) throw new GameError('no_game')
      const res = await r.useBooster(userId, type, row, c, async (t) => {
        const { user } = await mutateUser(userId, (u) => {
          if (!(u.data.boosters[t] > 0)) throw new GameError('no_booster')
          u.data.boosters[t]--
        })
        emit(userId, 'profile', selfView(user))
      })
      if (res.error) throw new GameError(res.error)
    }))

    socket.on('game:emote', guard(async ({ emote }) => {
      activeRoom(userId)?.emote(userId, emote)
    }))

    socket.on('game:resign', guard(async () => {
      activeRoom(userId)?.resign(userId)
    }))

    socket.on('game:leave', guard(async () => {
      const r = rooms.get(userRoom.get(userId))
      if (r && r.phase === 'over') userRoom.delete(userId)
    }))

    socket.on('disconnect', async () => {
      const n = (online.get(userId) || 1) - 1
      if (n > 0) online.set(userId, n)
      else online.delete(userId)
      const sockets = await io.in(`u:${userId}`).fetchSockets()
      if (sockets.length) return
      queue.delete(userId)
      activeRoom(userId)?.disconnected(userId)
    })
  })
}

/** Ends the user's session: resigns an active game, drops them from queues and disconnects */
export function kickUser(userId) {
  queue.delete(userId)
  for (const [c, d] of duels) if (d.hostId === userId) duels.delete(c)
  activeRoom(userId)?.resign(userId)
  io?.in(`u:${userId}`).disconnectSockets(true)
}

export const emitToUser = (userId, event, payload) => emit(userId, event, payload)

export function notifyProfile(userId, profile) {
  emit(userId, 'profile', profile)
}
