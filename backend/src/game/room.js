import crypto from 'crypto'
import {
  createBoard, fire, allSunk, sunkShips, remainingSizes, validateFleet, randomFleet, emptyCells,
  inBounds, CELL, publicShip,
} from '../../../shared/engine.js'
import { chooseShot } from '../../../shared/ai.js'
import { BOOSTERS_PER_MATCH } from '../../../shared/catalog.js'

export const TIMING = {
  placementPvp: 60_000,
  turnPvp: 30_000,
  reconnectGrace: 30_000,
  idleAi: 15 * 60_000,
  maxTimeouts: 3,
}

export const EMOTES = ['👋', '😎', '😱', '🔥', '🎯', '🤝', '😂', '💀']

const BOT_NAMES = {
  easy: { ru: 'Кадет Бот', en: 'Cadet Bot' },
  medium: { ru: 'Старпом Бот', en: 'First Mate Bot' },
  hard: { ru: 'Адмирал Бот', en: 'Admiral Bot' },
  expert: { ru: 'Кракен-9000', en: 'Kraken-9000' },
}

export function botProfile(difficulty, lang = 'ru') {
  return {
    id: `bot_${difficulty}`,
    name: BOT_NAMES[difficulty]?.[lang] || 'Bot',
    bot: true,
    difficulty,
    level: { easy: 5, medium: 15, hard: 30, expert: 50 }[difficulty] || 1,
    rating: null,
    frame: difficulty === 'expert' ? 'frame_neon' : 'frame_none',
  }
}

/**
 * One match between two seats. Seat 0/1 can be a human or a bot.
 * The room never trusts the client: it owns both boards and validates every action.
 */
export class GameRoom {
  constructor({ mode, seats, difficulty = null, level = null, duelCode = null, hooks }) {
    this.id = crypto.randomUUID()
    this.mode = mode // ai | campaign | ranked | duel
    this.difficulty = difficulty
    this.level = level
    this.duelCode = duelCode
    this.hooks = hooks // { emit(userId, event, payload), onFinish(room), onClose(room) }
    this.phase = 'placement'
    this.turn = 0
    this.deadline = null
    this.createdAt = Date.now()
    this.startedAt = null
    this.moves = []
    this.result = null
    this.timers = {}
    this.rematch = new Set()
    this.seats = seats.map((s) => ({
      ...s, // { kind: 'human'|'bot', userId?, profile, boosters? }
      board: null,
      ships: null,
      ready: false,
      connected: true,
      timeouts: 0,
      shots: 0,
      hits: 0,
      chain: 0,
      bestChain: 0,
      sunk: 0,
      boostersUsed: 0,
      scans: [],
      lastEmote: 0,
    }))
    if (this.timed) this.setDeadline(TIMING.placementPvp, () => this.placementTimeout())
    else this.touch()
    for (const seat of this.seats) if (seat.kind === 'bot') this.placeShips(seat, randomFleet())
  }

  get timed() {
    return this.mode === 'ranked' || this.mode === 'duel'
  }

  get boostersAllowed() {
    return this.mode === 'ai' || this.mode === 'campaign'
  }

  seatOf(userId) {
    return this.seats.findIndex((s) => s.kind === 'human' && s.userId === userId)
  }

  humans() {
    return this.seats.filter((s) => s.kind === 'human')
  }

  /* ───────── timers ───────── */

  clearTimer(name = 'main') {
    clearTimeout(this.timers[name])
    delete this.timers[name]
  }

  setDeadline(ms, fn) {
    this.clearTimer()
    this.deadline = Date.now() + ms
    this.timers.main = setTimeout(fn, ms)
  }

  /** AI games have no turn timer, but idle rooms are cleaned up */
  touch() {
    if (this.timed) return
    this.clearTimer('idle')
    this.timers.idle = setTimeout(() => {
      if (this.phase !== 'over') this.finish(this.seats.findIndex((s) => s.kind === 'bot'), 'abandoned')
    }, TIMING.idleAi)
  }

  dispose() {
    for (const k of Object.keys(this.timers)) this.clearTimer(k)
  }

  /* ───────── placement ───────── */

  placeShips(seat, ships) {
    seat.ships = ships.map((s, i) => ({ ...s, id: i }))
    seat.board = createBoard(seat.ships)
    seat.ready = true
  }

  place(userId, ships) {
    const i = this.seatOf(userId)
    if (i < 0 || this.phase !== 'placement') return { error: 'bad_phase' }
    const seat = this.seats[i]
    if (seat.ready) return { error: 'already_ready' }
    const fleet = ships === 'random' ? randomFleet() : validateFleet(ships)
    if (!fleet) return { error: 'invalid_fleet' }
    this.placeShips(seat, fleet)
    this.touch()
    if (this.seats.every((s) => s.ready)) this.startBattle()
    else this.broadcast()
    return { ok: true }
  }

  placementTimeout() {
    if (this.phase !== 'placement') return
    for (const seat of this.seats) if (!seat.ready) this.placeShips(seat, randomFleet())
    this.startBattle()
  }

  startBattle() {
    this.phase = 'battle'
    this.startedAt = Date.now()
    // Humans move first against bots; random otherwise
    const botSeat = this.seats.findIndex((s) => s.kind === 'bot')
    this.turn = botSeat >= 0 ? 1 - botSeat : Math.random() < 0.5 ? 0 : 1
    this.nextTurn(false)
  }

  /* ───────── battle ───────── */

  nextTurn(switchSides) {
    if (this.phase !== 'battle') return
    if (switchSides) this.turn = 1 - this.turn
    const seat = this.seats[this.turn]
    if (seat.kind === 'bot') {
      this.clearTimer()
      this.deadline = null
      const delay = process.env.BOT_FAST ? 5 : 650 + Math.random() * 900
      this.timers.bot = setTimeout(() => this.botMove(), delay)
    } else if (this.timed) {
      this.setDeadline(TIMING.turnPvp, () => this.turnTimeout())
    } else {
      this.deadline = null
      this.touch()
    }
    this.broadcast()
  }

  botMove() {
    if (this.phase !== 'battle') return
    const seat = this.seats[this.turn]
    const target = this.seats[1 - this.turn].board
    const [r, c] = chooseShot(target.shots, remainingSizes(target), seat.profile.difficulty)
    this.applyShot(this.turn, [[r, c]])
  }

  turnTimeout() {
    if (this.phase !== 'battle') return
    const seat = this.seats[this.turn]
    seat.timeouts++
    if (seat.timeouts >= TIMING.maxTimeouts) return this.finish(1 - this.turn, 'timeout')
    const cells = emptyCells(this.seats[1 - this.turn].board.shots)
    const [r, c] = cells[Math.floor(Math.random() * cells.length)]
    this.applyShot(this.turn, [[r, c]], { auto: true })
  }

  fire(userId, r, c) {
    const i = this.seatOf(userId)
    if (i < 0 || this.phase !== 'battle') return { error: 'bad_phase' }
    if (this.turn !== i) return { error: 'not_your_turn' }
    if (!Number.isInteger(r) || !Number.isInteger(c) || !inBounds(r, c)) return { error: 'bad_cell' }
    if (this.seats[1 - i].board.shots[r][c] !== CELL.EMPTY) return { error: 'already_shot' }
    this.seats[i].timeouts = 0
    this.applyShot(i, [[r, c]])
    return { ok: true }
  }

  /**
   * Boosters. `consume` is an async callback that deducts the booster from the
   * player's inventory (server-side) and throws if they don't own one.
   */
  async useBooster(userId, type, r, c, consume) {
    const i = this.seatOf(userId)
    if (i < 0 || this.phase !== 'battle' || this.turn !== i) return { error: 'not_your_turn' }
    if (!this.boostersAllowed) return { error: 'boosters_disabled' }
    if (!['radar', 'barrage'].includes(type)) return { error: 'bad_booster' }
    if (!Number.isInteger(r) || !Number.isInteger(c) || !inBounds(r, c)) return { error: 'bad_cell' }
    const seat = this.seats[i]
    if (seat.boostersUsed >= BOOSTERS_PER_MATCH) return { error: 'booster_limit' }
    const target = this.seats[1 - i].board
    if (type === 'barrage') {
      const cells = [[r, c], [r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].filter(
        ([rr, cc]) => inBounds(rr, cc) && target.shots[rr][cc] === CELL.EMPTY,
      )
      if (!cells.length) return { error: 'bad_cell' }
      seat.boostersUsed++ // reserve before await to avoid double use
      try {
        await consume(type)
      } catch (e) {
        seat.boostersUsed--
        return { error: e.code || 'no_booster' }
      }
      if (this.phase !== 'battle' || this.turn !== i) return { error: 'not_your_turn' }
      this.applyShot(i, cells, { booster: 'barrage' })
      return { ok: true }
    }
    // radar
    seat.boostersUsed++
    try {
      await consume(type)
    } catch (e) {
      seat.boostersUsed--
      return { error: e.code || 'no_booster' }
    }
    let count = 0
    const area = []
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const rr = r + dr
        const cc = c + dc
        if (!inBounds(rr, cc)) continue
        area.push([rr, cc])
        if (target.occ[rr][cc] >= 0 && target.shots[rr][cc] === CELL.EMPTY) count++
      }
    }
    seat.scans.push({ r, c, count })
    this.emitTo(seat, 'game:radar', { r, c, count, area })
    this.broadcast()
    return { ok: true }
  }

  applyShot(i, cells, meta = {}) {
    const shooter = this.seats[i]
    const target = this.seats[1 - i].board
    const results = []
    for (const [r, c] of cells) {
      const res = fire(target, r, c)
      if (!res.ok) continue
      shooter.shots++
      if (res.result === 'miss') {
        shooter.chain = 0
      } else {
        shooter.hits++
        shooter.chain++
        shooter.bestChain = Math.max(shooter.bestChain, shooter.chain)
        if (res.result === 'sunk') shooter.sunk++
      }
      results.push(res)
      this.moves.push({ s: i, r, c, x: res.result[0], t: Date.now() - (this.startedAt || this.createdAt) })
    }
    const anyHit = results.some((r) => r.result !== 'miss')
    for (let k = 0; k < this.seats.length; k++) {
      this.emitTo(this.seats[k], 'game:shot', {
        by: k === i ? 'me' : 'opp',
        results: results.map(({ r, c, result, ship, around }) => ({ r, c, result, ship, around })),
        ...meta,
      })
    }
    if (allSunk(target)) return this.finish(i, 'victory')
    this.nextTurn(!anyHit)
  }

  emote(userId, emoteId) {
    const i = this.seatOf(userId)
    if (i < 0 || !EMOTES.includes(emoteId)) return
    const seat = this.seats[i]
    if (Date.now() - seat.lastEmote < 2500) return
    seat.lastEmote = Date.now()
    this.emitTo(this.seats[1 - i], 'game:emote', { emote: emoteId })
  }

  resign(userId) {
    const i = this.seatOf(userId)
    if (i < 0 || this.phase === 'over') return
    this.finish(1 - i, 'resign')
  }

  /* ───────── connection ───────── */

  disconnected(userId) {
    const i = this.seatOf(userId)
    if (i < 0 || this.phase === 'over') return
    const seat = this.seats[i]
    seat.connected = false
    if (!this.timed) return
    const opp = this.seats[1 - i]
    this.emitTo(opp, 'game:opponent', { connected: false, graceMs: TIMING.reconnectGrace })
    this.clearTimer(`dc${i}`)
    this.timers[`dc${i}`] = setTimeout(() => {
      if (!seat.connected && this.phase !== 'over') this.finish(1 - i, 'disconnect')
    }, TIMING.reconnectGrace)
  }

  reconnected(userId) {
    const i = this.seatOf(userId)
    if (i < 0) return
    this.seats[i].connected = true
    this.clearTimer(`dc${i}`)
    this.emitTo(this.seats[1 - i], 'game:opponent', { connected: true })
    this.emitTo(this.seats[i], 'game:state', this.snapshot(i))
  }

  /* ───────── finish ───────── */

  finish(winnerSeat, reason) {
    if (this.phase === 'over') return
    this.phase = 'over'
    this.deadline = null
    this.dispose()
    this.result = { winnerSeat, reason, endedAt: Date.now() }
    this.hooks.onFinish(this)
  }

  /* ───────── views ───────── */

  emitTo(seat, event, payload) {
    if (seat.kind === 'human') this.hooks.emit(seat.userId, event, payload)
  }

  broadcast() {
    this.seats.forEach((seat, i) => this.emitTo(seat, 'game:state', this.snapshot(i)))
  }

  snapshot(i) {
    const me = this.seats[i]
    const opp = this.seats[1 - i]
    const over = this.phase === 'over'
    return {
      id: this.id,
      mode: this.mode,
      difficulty: this.difficulty,
      level: this.level,
      duelCode: this.duelCode,
      phase: this.phase,
      myTurn: this.phase === 'battle' && this.turn === i,
      deadline: this.deadline,
      serverNow: Date.now(),
      boostersAllowed: this.boostersAllowed,
      boostersLeft: this.boostersAllowed ? Math.max(0, BOOSTERS_PER_MATCH - me.boostersUsed) : 0,
      me: {
        profile: me.profile,
        ready: me.ready,
        ships: me.ships ? me.ships.map(publicShip) : null,
        shots: me.board ? me.board.shots : null,
        remaining: me.board ? remainingSizes(me.board) : null,
        stats: { shots: me.shots, hits: me.hits, sunk: me.sunk },
        scans: me.scans,
      },
      opp: {
        profile: opp.profile,
        ready: opp.ready,
        connected: opp.connected,
        shots: opp.board ? opp.board.shots : null,
        sunk: opp.board ? sunkShips(opp.board) : [],
        remaining: opp.board ? remainingSizes(opp.board) : null,
        ships: over && opp.ships ? opp.ships.map(publicShip) : null,
        stats: { shots: opp.shots, hits: opp.hits, sunk: opp.sunk },
      },
      result: this.result && { won: this.result.winnerSeat === i, reason: this.result.reason },
    }
  }

  /** Stats used for rewards */
  seatStats(i) {
    const s = this.seats[i]
    return {
      shots: s.shots,
      hits: s.hits,
      sunk: s.sunk,
      bestHitChain: s.bestChain,
      shipsLost: s.board ? s.board.ships.filter((sh) => sh.hits >= sh.size).length : 0,
    }
  }
}
