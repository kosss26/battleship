import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import { config } from '../config.js'
import { GameRoom, botProfile } from './room.js'
import { CAMPAIGN, AI_DIFFICULTIES } from './constants.js'
import { getUser, publicProfile, mutateUser, selfView, GameError } from '../services/users.js'
import { applyMatchResult, saveGame } from '../services/match.js'
import { eloDelta } from '../services/elo.js'

const rooms = new Map() // roomId -> GameRoom
const userRoom = new Map() // userId -> roomId
const queue = new Map() // userId -> { rating, games, since, profile }
const duels = new Map() // code -> { hostId, createdAt, profile }

let io = null

const emit = (userId, event, payload) => io?.to(`u:${userId}`).emit(event, payload)

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

  if (room.mode === 'ranked' && played) {
    const [a, b] = room.seats
    deltas[0] = eloDelta(a.profile.rating, b.profile.rating, winnerSeat === 0 ? 1 : 0, a.rankedGames)
    deltas[1] = eloDelta(b.profile.rating, a.profile.rating, winnerSeat === 1 ? 1 : 0, b.rankedGames)
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
    saveGame({
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

    socket.on('duel:create', guard(async () => {
      ensureFree()
      const u = await loadProfile()
      // Idempotent: a host has at most one open invite
      for (const [c, d] of duels) {
        if (d.hostId === userId) {
          d.createdAt = Date.now()
          return { code: c }
        }
      }
      let code
      do code = crypto.randomBytes(4).toString('hex').toUpperCase().slice(0, 6)
      while (duels.has(code))
      duels.set(code, { hostId: userId, createdAt: Date.now(), profile: publicProfile(u) })
      return { code }
    }))

    socket.on('duel:cancel', guard(async () => {
      for (const [c, d] of duels) if (d.hostId === userId) duels.delete(c)
    }))

    socket.on('duel:join', guard(async ({ code }) => {
      const key = String(code || '').toUpperCase()
      const duel = duels.get(key)
      if (!duel) throw new GameError('duel_not_found')
      if (duel.hostId === userId) return { hosting: true }
      ensureFree()
      if (activeRoom(duel.hostId)) throw new GameError('host_busy')
      const u = await loadProfile()
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

export function notifyProfile(userId, profile) {
  emit(userId, 'profile', profile)
}
