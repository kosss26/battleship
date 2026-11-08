import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'

process.env.PORT = '5077'
process.env.NODE_ENV = 'test'
process.env.BOT_FAST = '1'
process.env.ALLOW_DEV_LOGIN = 'true'
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgres://bs:bs@localhost:5432/battleship_test'
process.env.TELEGRAM_BOT_TOKEN = ''

const { start } = await import('../src/server.js')
const { query, closeDb, migrate } = await import('../src/db.js')
const { io: ioClient } = await import('socket.io-client')
const { SIZE, CELL } = await import('../../shared/engine.js')

const BASE = 'http://localhost:5077'
let server

const api = async (path, { token, method = 'GET', body } = {}) => {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: res.status, body: await res.json() }
}

const login = async (name, ref) => (await api('/auth/dev', { method: 'POST', body: { name, ref } })).body

function connect(token) {
  const s = ioClient(BASE, { auth: { token }, transports: ['websocket'], forceNew: true })
  s.state = null
  s.on('game:state', (st) => { s.state = st; s.version = (s.version || 0) + 1 })
  s.on('game:over', (o) => { s.over = o })
  s.on('profile', (p) => { s.profile = p })
  return new Promise((resolve, reject) => {
    s.on('connect', () => resolve(s))
    s.on('connect_error', reject)
  })
}

const call = (s, ev, data) => new Promise((r) => s.emit(ev, data, r))
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
async function until(fn, ms = 8000) {
  const t = Date.now()
  while (Date.now() - t < ms) {
    const v = fn()
    if (v) return v
    await wait(20)
  }
  throw new Error('timeout')
}

/** Shoots the first unknown cell on the opponent board */
function nextTarget(state) {
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (state.opp.shots[r][c] === CELL.EMPTY) return { r, c }
  return null
}

before(async () => {
  await migrate()
  await query('TRUNCATE game_rooms, match_notifications CASCADE')
  ;({ httpServer: server } = await start().then((x) => ({ httpServer: x.httpServer, io: x.io })).then((x) => { globalThis.__io = x.io; return x }))
  await query('TRUNCATE payments, games, users RESTART IDENTITY CASCADE')
})

after(async () => {
  globalThis.__io?.close()
  server?.close()
  await closeDb()
  setTimeout(() => process.exit(0), 100).unref()
})

test('auth, profile, daily reward, shop', async () => {
  const { token, profile } = await login('Alice')
  assert.ok(token)
  assert.equal(profile.gold, 500)
  assert.equal(profile.quests.length, 3)
  assert.equal((await api('/me')).status, 401)

  const d = await api('/me/daily', { token, method: 'POST' })
  assert.equal(d.body.summary.gold, 100)
  assert.equal((await api('/me/daily', { token, method: 'POST' })).body.error, 'already_claimed')

  const buy = await api('/me/shop/buy', { token, method: 'POST', body: { itemId: 'booster:radar' } })
  assert.equal(buy.body.profile.boosters.radar, 3)
  assert.equal(buy.body.profile.gold, 600 - 250)
  const poor = await api('/me/shop/buy', { token, method: 'POST', body: { itemId: 'theme_night' } })
  assert.equal(poor.body.error, 'not_enough_gold')
  const eq = await api('/me/equip', { token, method: 'POST', body: { itemId: 'theme_night' } })
  assert.equal(eq.body.error, 'not_owned')
})

test('full game vs AI with boosters and rewards', async () => {
  const { token } = await login('Bob')
  const s = await connect(token)
  assert.equal((await call(s, 'ai:start', { difficulty: 'bogus' })).error, 'bad_difficulty')
  const res = await call(s, 'ai:start', { difficulty: 'easy' })
  assert.ok(res.room)
  await until(() => s.state?.phase === 'placement')
  assert.equal((await call(s, 'game:place', { ships: [{ r: 0, c: 0, size: 4 }] })).error, 'invalid_fleet')
  assert.ok((await call(s, 'game:place', { ships: 'random' })).ok)
  await until(() => s.state?.phase === 'battle' && s.state.myTurn)

  // Radar does not consume the turn
  const radar = await call(s, 'game:booster', { type: 'radar', r: 5, c: 5 })
  assert.ok(radar.ok, JSON.stringify(radar))
  await until(() => s.state.me.scans.length === 1)
  assert.equal(s.state.boostersLeft, 1)

  let guard = 0
  while (!s.over && guard++ < 120) {
    await until(() => s.over || (s.state.phase === 'battle' && s.state.myTurn), 10000)
    if (s.over) break
    const t = nextTarget(s.state)
    const v = s.version
    const r = await call(s, 'game:fire', t)
    if (r.error) assert.fail(r.error)
    await until(() => s.over || s.version > v)
  }
  await until(() => s.over, 15000)
  assert.ok(s.over.rewards.xp > 0)
  assert.ok(s.over.state.opp.ships.length === 10, 'opponent fleet revealed at the end')
  const me = (await api('/me', { token })).body.profile
  assert.equal(me.stats.games, 1)
  assert.equal(me.boosters.radar, 1)
  s.close()
})

test('ranked matchmaking, cheating attempts and resign', async () => {
  const a = await login('Carol')
  const b = await login('Dave', a.profile.refCode)
  const sa = await connect(a.token)
  const sb = await connect(b.token)
  await call(sa, 'mm:join')
  await call(sb, 'mm:join')
  await until(() => sa.state?.mode === 'ranked' && sb.state?.mode === 'ranked', 5000)
  await call(sa, 'game:place', { ships: 'random' })
  await call(sb, 'game:place', { ships: 'random' })
  await until(() => sa.state.phase === 'battle' && sb.state.phase === 'battle')

  // Opponent ships are never sent during battle
  assert.equal(sa.state.opp.ships, null)
  const [turnSock, idle] = sa.state.myTurn ? [sa, sb] : [sb, sa]
  assert.equal((await call(idle, 'game:fire', { r: 0, c: 0 })).error, 'not_your_turn')
  assert.equal((await call(turnSock, 'game:fire', { r: 11, c: 0 })).error, 'bad_cell')
  assert.equal((await call(turnSock, 'game:booster', { type: 'radar', r: 1, c: 1 })).error, 'boosters_disabled')

  await call(idle, 'game:resign')
  await until(() => sa.over && sb.over)
  const winner = sa.over.won ? sa : sb
  const loser = sa.over.won ? sb : sa
  // Instant resignation: the quitter loses rating, the winner gains nothing (anti-farming)
  assert.equal(winner.over.extra.ratingDelta, 0)
  assert.equal(winner.over.extra.ratingNote, 'early_forfeit')
  assert.ok(loser.over.extra.ratingDelta < 0)
  // A win by resignation must not unlock skill achievements
  assert.ok(!winner.over.rewards.achievements.includes('perfect'))
  assert.ok(!winner.over.rewards.achievements.includes('fast_win'))

  // Referral: Carol gets rewarded after Dave played
  await wait(200)
  const carol = (await api('/me', { token: a.token })).body.profile
  assert.equal(carol.stats.referrals, 1)
  const refs = (await api('/me/referrals', { token: a.token })).body
  assert.equal(refs.total, 1)

  const lb = (await api('/leaderboard?type=rating', { token: a.token })).body
  assert.ok(lb.entries.length >= 2)
  sa.close()
  sb.close()
})

test('friend duel via code', async () => {
  const a = await login('Eve')
  const b = await login('Frank')
  const sa = await connect(a.token)
  const sb = await connect(b.token)
  const { code } = await call(sa, 'duel:create')
  assert.match(code, /^\d{5}$/)
  assert.equal((await call(sb, 'duel:join', { code: '00000' })).error, 'duel_not_found')
  const j = await call(sb, 'duel:join', { code: ` ${code.slice(0, 2)} ${code.slice(2)} ` }) // spaces are ignored
  assert.ok(j.room)
  await until(() => sa.state?.mode === 'duel' && sb.state?.mode === 'duel')
  await call(sa, 'game:resign')
  await until(() => sa.over && sb.over)
  assert.equal(sb.over.won, true)
  sa.close()
  sb.close()
})

test('campaign gating', async () => {
  const { token } = await login('Gina')
  const s = await connect(token)
  assert.equal((await call(s, 'ai:start', { level: 3 })).error, 'level_locked')
  assert.ok((await call(s, 'ai:start', { level: 1 })).room)
  await until(() => s.state?.mode === 'campaign')
  s.close()
})
