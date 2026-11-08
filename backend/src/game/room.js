import crypto from 'crypto'
import {
  createBoard, fire, allSunk, sunkShips, remainingSizes, validateFleet, randomFleet, emptyCells,
  inBounds, CELL, publicShip,
} from '../../../shared/engine.js'
import { chooseShot } from '../../../shared/ai.js'
import { BOOSTERS_PER_MATCH, FOG_MEMORY, BLITZ_MS } from '../../../shared/catalog.js'

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
  constructor({ mode, seats, difficulty = null, level = null, duelCode = null, mods = {}, hooks, restored = null, demoFleet = null }) {
    this.id = crypto.randomUUID()
    this.mode = mode // ai | campaign | ranked | duel
    this.demoFleet = mode === 'ai' && demoFleet === 'regent' ? 'regent' : null
    this.difficulty = difficulty
    this.level = level
    this.duelCode = duelCode
    this.mods = mods // campaign special rules, see MODIFIERS in the catalogue
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
    this.work = Promise.resolve()
    this.idleDeadline = null
    this.recovering = false
    this.pendingEvents = null
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
      missAt: new Map(), // fog: cell key -> shooter's shot number when it was last seen
      haloHidden: new Set(), // noHalo: auto-marked cells the shooter is not shown
    }))
    if (restored) { this.restore(restored); return }
    if (this.timed) this.setDeadline(TIMING.placementPvp, () => this.placementTimeout())
    else this.touch()
    for (const seat of this.seats) if (seat.kind === 'bot') this.placeShips(seat, randomFleet())
  }

  serialize() {
    const { hooks, timers, work, pendingEvents, storageDirty, settled, completion, ...data } = this
    return JSON.parse(JSON.stringify({ ...data, version: 1, rematch: [...this.rematch],
      seats: this.seats.map(s => ({ ...s, missAt: [...s.missAt], haloHidden: [...s.haloHidden] })) }))
  }

  restore(data) {
    this.dispose()
    if (data.version !== 1) throw new Error('Unsupported room snapshot')
    Object.assign(this, data, { rematch: new Set(data.rematch), seats: data.seats.map(s => ({
      ...s, missAt: new Map(s.missAt), haloHidden: new Set(s.haloHidden),
    })) })
  }

  /** Serialize all actions, including timers. Publish only after the DB commit. */
  run(action) {
    const task = this.work.then(async () => {
      const before = this.serialize()
      this.pendingEvents = []
      let value
      try {
        if (this.storageDirty) await this.reloadCommittedState()
        const execute = async client => {
          value = await action(client)
          if (this.hooks.persist) await this.hooks.persist(this.serialize(), client)
        }
        if (this.hooks.transaction) await this.hooks.transaction(execute)
        else await execute()
      } catch (error) {
        this.restore(before)
        this.pendingEvents = null
        if (this.hooks.load) {
          this.storageDirty = true
          try { await this.reloadCommittedState() }
          catch { this.dispose(); this.setTimer('storage', 1000, () => {}) }
        } else this.armTimers()
        throw error
      }
      const events = this.pendingEvents
      this.pendingEvents = null
      for (const [userId, event, payload] of events) this.hooks.emit(userId, event, payload)
      if (this.phase === 'over' && before.phase !== 'over') this.hooks.onFinish(this)
      return value
    })
    this.work = task.catch(() => {})
    return task
  }

  async reloadCommittedState() {
    const saved = await this.hooks.load(this.id)
    if (saved) {
      this.restore(saved.state)
      this.settled = !!saved.settlement
      this.completion = saved.settlement
      if (this.phase !== 'over' && this.hooks.connected) {
        this.recover(new Date(saved.updated_at).getTime())
        for (const s of this.humans()) if (this.hooks.connected(s.userId)) this.reconnected(s.userId)
      } else this.armTimers()
      if (this.phase === 'over' && !this.settled) this.hooks.onFinish(this)
    }
    this.storageDirty = false
  }

  setTimer(name, ms, fn) {
    this.clearTimer(name)
    const timer = setTimeout(() => {
      this.run(() => { if (this.timers[name] === timer) return fn() })
        .catch(e => console.error('[room-timer]', this.id, e.message))
    }, Math.max(1, ms))
    this.timers[name] = timer
  }

  armTimers() {
    this.dispose()
    if (this.phase === 'over') return
    if (this.recovering) {
      this.setTimer('recovery', Math.max(1000, this.recoveryUntil - Date.now()), () => this.finish(null, 'server_restart'))
      return
    }
    const retryDelay = until => Math.max(1000, until - Date.now())
    if (this.phase === 'placement' && this.timed) this.setTimer('main', retryDelay(this.deadline), () => this.placementTimeout())
    else if (this.phase === 'battle' && this.seats[this.turn].kind === 'bot') this.setTimer('bot', 650, () => this.botMove())
    else if (this.phase === 'battle' && this.turnMs) this.setTimer('main', retryDelay(this.deadline), () => this.turnTimeout())
    if (!this.timed) this.setTimer('idle', retryDelay(this.idleDeadline), () => this.finish(this.seats.findIndex(s => s.kind === 'bot'), 'abandoned'))
    this.seats.forEach((s, i) => {
      if (this.timed && !s.connected) this.setTimer(`dc${i}`, retryDelay(s.disconnectUntil), () => {
        if (!s.connected) this.finish(1 - i, 'disconnect')
      })
    })
  }

  recover(savedAt) {
    if (this.phase === 'over') return
    if (!this.recovering) {
      this.recoveryRemaining = this.deadline == null ? null : Math.max(1000, this.deadline - savedAt)
      this.recoveryIdle = Math.max(1000, (this.idleDeadline || savedAt + TIMING.idleAi) - savedAt)
    }
    this.recovering = true
    this.recoveryUntil = Date.now() + 5 * 60_000
    for (const s of this.humans()) s.connected = false
    this.armTimers()
  }

  get timed() {
    return this.mode === 'ranked' || this.mode === 'duel'
  }

  get boostersAllowed() {
    if (this.demoFleet) return false
    return (this.mode === 'ai' || this.mode === 'campaign') && !this.mods.noBoosters
  }

  /** Per-turn time limit for a human, or null */
  get turnMs() {
    if (this.timed) return TIMING.turnPvp
    if (this.mods.blitz) return BLITZ_MS
    return null
  }

  /* ───────── hidden information (fog / noHalo) ───────── */

  isHidden(i, r, c) {
    const seat = this.seats[i]
    const key = r * 10 + c
    if (this.mods.noHalo && seat.haloHidden.has(key)) return true
    if (this.mods.fog && seat.missAt.has(key) && seat.shots - seat.missAt.get(key) >= FOG_MEMORY) return true
    return false
  }

  /** The enemy board as seat i is allowed to see it */
  visibleShots(i) {
    const board = this.seats[1 - i].board
    if (!board) return null
    if (!this.mods.fog && !this.mods.noHalo) return board.shots
    return board.shots.map((row, r) => row.map((v, c) => (v === CELL.MISS && this.isHidden(i, r, c) ? CELL.EMPTY : v)))
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
    this.setTimer('main', ms, fn)
  }

  /** AI games have no turn timer, but idle rooms are cleaned up */
  touch() {
    if (this.timed) return
    this.clearTimer('idle')
    this.idleDeadline = Date.now() + TIMING.idleAi
    this.setTimer('idle', TIMING.idleAi, () => {
      if (this.phase !== 'over') this.finish(this.seats.findIndex((s) => s.kind === 'bot'), 'abandoned')
    })
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
    if (botSeat >= 0) this.turn = this.mods.enemyFirst ? botSeat : 1 - botSeat
    else this.turn = Math.random() < 0.5 ? 0 : 1
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
      this.setTimer('bot', delay, () => this.botMove())
    } else if (this.turnMs) {
      this.setDeadline(this.turnMs, () => this.turnTimeout())
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
    // In PvP three missed turns forfeit the game; in blitz missions you just lose the shot
    if (this.timed && seat.timeouts >= TIMING.maxTimeouts) return this.finish(1 - this.turn, 'timeout')
    const cells = emptyCells(this.visibleShots(this.turn))
    const [r, c] = cells[Math.floor(Math.random() * cells.length)]
    if (this.seats[1 - this.turn].board.shots[r][c] !== CELL.EMPTY) return this.wastedShot(this.turn, r, c, { auto: true })
    this.applyShot(this.turn, [[r, c]], { auto: true })
  }

  fire(userId, r, c) {
    if (this.recovering) return { error: 'game_recovering' }
    const i = this.seatOf(userId)
    if (i < 0 || this.phase !== 'battle') return { error: 'bad_phase' }
    if (this.turn !== i) return { error: 'not_your_turn' }
    if (!Number.isInteger(r) || !Number.isInteger(c) || !inBounds(r, c)) return { error: 'bad_cell' }
    const v = this.seats[1 - i].board.shots[r][c]
    if (v !== CELL.EMPTY) {
      // Firing into a cell hidden by fog / noHalo is allowed — it is a wasted miss
      if (v === CELL.MISS && this.isHidden(i, r, c)) {
        this.seats[i].timeouts = 0
        this.wastedShot(i, r, c)
        return { ok: true }
      }
      return { error: 'already_shot' }
    }
    this.seats[i].timeouts = 0
    this.applyShot(i, [[r, c]])
    return { ok: true }
  }

  /** A shot into an already-known (but hidden) miss: costs a shot and the turn, reveals the cell again */
  wastedShot(i, r, c, meta = {}) {
    const shooter = this.seats[i]
    shooter.shots++
    shooter.chain = 0
    const key = r * 10 + c
    shooter.haloHidden.delete(key)
    shooter.missAt.set(key, shooter.shots)
    this.moves.push({ s: i, r, c, x: 'w', t: Date.now() - (this.startedAt || this.createdAt) })
    for (let k = 0; k < this.seats.length; k++) {
      this.emitTo(this.seats[k], 'game:shot', { by: k === i ? 'me' : 'opp', results: [{ r, c, result: 'miss' }], wasted: true, ...meta })
    }
    if (this.outOfAmmo(i)) return this.finish(1 - i, 'out_of_ammo')
    this.nextTurn(true)
  }

  outOfAmmo(i) {
    return !!this.mods.ammo && this.seats[i].kind === 'human' && this.seats[i].shots >= this.mods.ammo
  }

  /**
   * Boosters. `consume` is an async callback that deducts the booster from the
   * player's inventory (server-side) and throws if they don't own one.
   */
  async useBooster(userId, type, r, c, consume) {
    if (this.recovering) return { error: 'game_recovering' }
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
      if (shooter.kind === 'human') {
        if (res.result === 'miss') shooter.missAt.set(r * 10 + c, shooter.shots)
        if (res.around && this.mods.noHalo) for (const [hr, hc] of res.around) shooter.haloHidden.add(hr * 10 + hc)
      }
    }
    const anyHit = results.some((r) => r.result !== 'miss')
    for (let k = 0; k < this.seats.length; k++) {
      // With noHalo the shooter is not told which cells around a sunk ship are empty
      const hideHalo = this.mods.noHalo && k === i
      this.emitTo(this.seats[k], 'game:shot', {
        by: k === i ? 'me' : 'opp',
        results: results.map(({ r, c, result, ship, around }) => ({ r, c, result, ship, around: hideHalo ? undefined : around })),
        ...meta,
      })
    }
    if (allSunk(target)) return this.finish(i, 'victory')
    if (this.outOfAmmo(i)) return this.finish(1 - i, 'out_of_ammo')
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
    this.finish(this.recovering ? null : 1 - i, this.recovering ? 'server_restart' : 'resign')
  }

  /* ───────── connection ───────── */

  disconnected(userId) {
    const i = this.seatOf(userId)
    if (i < 0 || this.phase === 'over') return
    const seat = this.seats[i]
    seat.connected = false
    if (this.recovering) return
    if (!this.timed) return
    const opp = this.seats[1 - i]
    this.emitTo(opp, 'game:opponent', { connected: false, graceMs: TIMING.reconnectGrace })
    this.clearTimer(`dc${i}`)
    seat.disconnectUntil = Date.now() + TIMING.reconnectGrace
    this.setTimer(`dc${i}`, TIMING.reconnectGrace, () => {
      if (!seat.connected && this.phase !== 'over') this.finish(1 - i, 'disconnect')
    })
  }

  reconnected(userId) {
    const i = this.seatOf(userId)
    if (i < 0) return
    this.seats[i].connected = true
    if (this.recovering && this.humans().every(s => s.connected)) {
      this.recovering = false
      this.deadline = this.recoveryRemaining == null ? null : Date.now() + this.recoveryRemaining
      this.idleDeadline = Date.now() + this.recoveryIdle
      this.armTimers()
      this.broadcast()
    }
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
    if (!this.pendingEvents) this.hooks.onFinish(this)
  }

  /* ───────── views ───────── */

  emitTo(seat, event, payload) {
    if (seat.kind === 'human') {
      if (this.pendingEvents) this.pendingEvents.push([seat.userId, event, structuredClone(payload)])
      else this.hooks.emit(seat.userId, event, payload)
    }
  }

  broadcast() {
    this.seats.forEach((seat, i) => this.emitTo(seat, 'game:state', this.snapshot(i)))
  }

  snapshot(i) {
    const me = this.seats[i]
    const opp = this.seats[1 - i]
    const over = this.phase === 'over'
    const appearance = p => this.demoFleet === 'regent'
      ? { ...p, shipSkin:'ship_regent', boardTheme:'theme_regent', shotEffect:'fx_regent', frame:'frame_regent' } : p
    return {
      id: this.id,
      mode: this.mode,
      demoFleet: this.demoFleet,
      difficulty: this.difficulty,
      level: this.level,
      duelCode: this.duelCode,
      phase: this.phase,
      recovering: this.recovering,
      myTurn: !this.recovering && this.phase === 'battle' && this.turn === i,
      deadline: this.deadline,
      serverNow: Date.now(),
      boostersAllowed: this.boostersAllowed,
      mods: this.mods,
      turnMs: this.turnMs,
      ammoLeft: this.mods.ammo ? Math.max(0, this.mods.ammo - me.shots) : null,
      boostersLeft: this.boostersAllowed ? Math.max(0, BOOSTERS_PER_MATCH - me.boostersUsed) : 0,
      me: {
        profile: appearance(me.profile),
        ready: me.ready,
        ships: me.ships ? me.ships.map(publicShip) : null,
        shots: me.board ? me.board.shots : null,
        remaining: me.board ? remainingSizes(me.board) : null,
        stats: { shots: me.shots, hits: me.hits, sunk: me.sunk },
        scans: me.scans,
      },
      opp: {
        profile: appearance(opp.profile),
        ready: opp.ready,
        connected: opp.connected,
        shots: over ? (opp.board ? opp.board.shots : null) : this.visibleShots(i),
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
