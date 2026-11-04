import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'crypto'

process.env.PORT = '5080'
process.env.NODE_ENV = 'test'
process.env.BOT_FAST = '1'
process.env.ALLOW_DEV_LOGIN = 'true'
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgres://bs:bs@localhost:5432/battleship_test'
process.env.TELEGRAM_BOT_TOKEN = ''

const { start } = await import('../src/server.js')
const { query, closeDb } = await import('../src/db.js')
const { closeSeason, checkSeasonRollover } = await import('../src/services/seasons.js')
const { seasonId, prevSeasonId, seasonInfo } = await import('../../shared/catalog.js')
const { io: ioClient } = await import('socket.io-client')
const { SIZE, CELL } = await import('../../shared/engine.js')

const BASE = 'http://localhost:5080'
let srv

const api = async (path, { token, method = 'GET', body } = {}) => {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: res.status, body: await res.json() }
}
const login = async (name) => (await api('/auth/dev', { method: 'POST', body: { name } })).body
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
function connect(token) {
  const s = ioClient(BASE, { auth: { token }, transports: ['websocket'], forceNew: true })
  s.on('game:state', (st) => { s.state = st; s.v = (s.v || 0) + 1 })
  s.on('game:over', (o) => { s.over = o })
  return new Promise((resolve) => s.on('connect', () => resolve(s)))
}
const call = (s, ev, data) => new Promise((r) => s.emit(ev, data, r))
async function until(fn, ms = 8000) {
  const t = Date.now()
  while (Date.now() - t < ms) {
    if (fn()) return
    await wait(15)
  }
  throw new Error('timeout')
}

/** Plays a full ranked game; `loserSock` fires 12+ shots, then resigns (not an early forfeit) */
async function rankedGame(sa, sb) {
  sa.over = null
  sb.over = null
  await call(sa, 'mm:join')
  await call(sb, 'mm:join')
  await until(() => sa.state?.phase === 'placement' && sb.state?.phase === 'placement' && !sa.state.me.ready)
  await call(sa, 'game:place', { ships: 'random' })
  await call(sb, 'game:place', { ships: 'random' })
  await until(() => sa.state.phase === 'battle')
  for (let i = 0; i < 400 && sa.state.phase === 'battle'; i++) {
    const s = sa.state.myTurn ? sa : sb.state.myTurn ? sb : null
    if (!s) {
      await wait(10)
      continue
    }
    let target
    for (let r = 0; r < SIZE && !target; r++) for (let c = 0; c < SIZE && !target; c++) if (s.state.opp.shots[r][c] === CELL.EMPTY) target = { r, c }
    const v = s.v
    await call(s, 'game:fire', target)
    await until(() => s.v > v || s.over)
    if (sa.state.me.stats.shots + sb.state.me.stats.shots >= 14) break
  }
  await call(sb, 'game:resign')
  await until(() => sa.over && sb.over)
  return { a: sa.over, b: sb.over }
}

before(async () => {
  srv = await start()
  await query('TRUNCATE season_results, meta, friendships, admin_log, payments, games, users RESTART IDENTITY CASCADE')
})
after(async () => {
  srv.io.close()
  srv.httpServer.close()
  await closeDb()
  setTimeout(() => process.exit(0), 100).unref()
})

test('repeat opponent: rating stops changing after 3 games a day', async () => {
  const A = await login('Repeat A')
  const B = await login('Repeat B')
  const sa = await connect(A.token)
  const sb = await connect(B.token)
  const deltas = []
  for (let i = 0; i < 4; i++) {
    const { a } = await rankedGame(sa, sb)
    deltas.push([a.extra.ratingDelta, a.extra.ratingNote])
    await wait(50)
  }
  assert.ok(deltas[0][0] > 0 && deltas[1][0] > 0 && deltas[2][0] > 0, JSON.stringify(deltas))
  assert.deepEqual(deltas[3], [0, 'repeat_opponent'])
  const admin = (await query('SELECT 1')).rows
  assert.ok(admin)
  sa.close()
  sb.close()
})

test('season close: results, rewards, soft reset, idempotent', async () => {
  const season = prevSeasonId(seasonId())
  const { startsAt } = seasonInfo(season)
  const pro = await login('Season Pro')
  const casual = await login('Season Casual')
  await query('UPDATE users SET rating = 1700 WHERE id = $1', [pro.profile.id])
  await query('UPDATE users SET rating = 1200 WHERE id = $1', [casual.profile.id])
  const ended = new Date(new Date(startsAt).getTime() + 86400_000)
  // pro: 6 ranked games last season (qualifies), casual: 2 (doesn't)
  for (let i = 0; i < 6; i++) {
    await query(`INSERT INTO games (id, mode, p1, p2, winner, winner_slot, reason, shots, duration_ms, ended_at)
      VALUES ($1,'ranked',$2,$3,$2,0,'victory',50,1000,$4)`, [crypto.randomUUID(), pro.profile.id, i < 2 ? casual.profile.id : null, ended])
  }
  await query("INSERT INTO meta (key, value) VALUES ('last_closed_season', '2000-01') ON CONFLICT (key) DO UPDATE SET value = '2000-01'")
  const n = await checkSeasonRollover()
  assert.ok(n >= 1)
  assert.equal(await closeSeason(season), null, 'closing twice does nothing')

  const me = (await api('/me', { token: pro.token })).body.profile
  assert.equal(me.rating, 1350, 'soft reset 1700 → 1350')
  assert.equal(me.seasonResult.season, season)
  assert.equal(me.seasonResult.rank, 'captain')
  assert.equal(me.seasonResult.place, 1)
  assert.ok(me.seasonResult.reward.cosmetics.includes('frame_legend'))
  assert.equal((await api('/me', { token: casual.token })).body.profile.seasonResult, null)

  const claim = await api('/me/season/claim', { token: pro.token, method: 'POST', body: { season } })
  assert.equal(claim.status, 200)
  assert.ok(claim.body.profile.owned.includes('frame_officer'))
  assert.ok(claim.body.profile.owned.includes('frame_legend'))
  assert.equal(claim.body.profile.seasonResult, null)
  assert.equal((await api('/me/season/claim', { token: pro.token, method: 'POST', body: { season } })).body.error, 'already_claimed')

  const hist = (await api('/me/seasons', { token: pro.token })).body
  assert.equal(hist.history.length, 1)
  assert.equal(hist.current.id, seasonId())
})

test('account deletion wipes personal data and access', async () => {
  const u = await login('Delete Me')
  assert.equal((await api('/me/delete', { token: u.token, method: 'POST', body: {} })).body.error, 'confirmation_required')
  assert.equal((await api('/me/delete', { token: u.token, method: 'POST', body: { confirm: 'DELETE' } })).status, 200)
  const { rows } = await query('SELECT first_name, username, tg_id, banned FROM users WHERE id = $1', [u.profile.id])
  assert.deepEqual(rows[0], { first_name: 'Deleted', username: null, tg_id: null, banned: true })
  assert.equal((await api('/me', { token: u.token })).status, 403)
})
