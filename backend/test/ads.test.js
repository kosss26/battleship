import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'

process.env.PORT = '5081'
process.env.NODE_ENV = 'test'
process.env.BOT_FAST = '1'
process.env.ALLOW_DEV_LOGIN = 'true'
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgres://bs:bs@localhost:5432/battleship_test'
process.env.TELEGRAM_BOT_TOKEN = ''
process.env.ADSGRAM_BLOCK_ID = ''

const { start } = await import('../src/server.js')
const { query, closeDb, migrate } = await import('../src/db.js')
const { config } = await import('../src/config.js')
const { io: ioClient } = await import('socket.io-client')

const BASE = 'http://localhost:5081'
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
/** Pretend the ad started long enough ago and the cooldown has passed */
const age = (id) => query(
  `UPDATE users SET data = jsonb_set(jsonb_set(data, '{ads,session,at}', to_jsonb((extract(epoch from now()) * 1000)::bigint - 6000)), '{ads,lastAt}', '0') WHERE id = $1`,
  [id],
)
const resetCooldown = (id) => query(`UPDATE users SET data = jsonb_set(data, '{ads,lastAt}', '0') WHERE id = $1`, [id])

before(async () => {
  await migrate()
  await query('TRUNCATE game_rooms, match_notifications CASCADE')
  srv = await start()
  await query('TRUNCATE ad_views, season_results, meta, friendships, admin_log, payments, games, users RESTART IDENTITY CASCADE')
})
after(async () => {
  srv.io.close()
  srv.httpServer.close()
  await closeDb()
  setTimeout(() => process.exit(0), 100).unref()
})

test('free gold for an ad: limits, cooldown and anti-skip', async () => {
  const cfg = (await api('/config')).body.ads
  assert.deepEqual(cfg, { enabled: true, blockId: null, fake: true })
  const u = await login('Ad Viewer')
  const s1 = await api('/me/ads/start', { token: u.token, method: 'POST', body: { placement: 'gold' } })
  assert.ok(s1.body.sessionId)
  const fast = await api('/me/ads/complete', { token: u.token, method: 'POST', body: { sessionId: s1.body.sessionId } })
  assert.equal(fast.body.error, 'ad_too_fast')
  await age(u.profile.id)
  const done = await api('/me/ads/complete', { token: u.token, method: 'POST', body: { sessionId: s1.body.sessionId } })
  assert.equal(done.body.summary.gold, 100)
  assert.equal(done.body.profile.gold, u.profile.gold + 100)
  assert.equal(done.body.profile.ads.left.gold, 4)
  assert.equal((await api('/me/ads/complete', { token: u.token, method: 'POST', body: { sessionId: s1.body.sessionId } })).body.error, 'ad_session_invalid')
  assert.equal((await api('/me/ads/start', { token: u.token, method: 'POST', body: { placement: 'gold' } })).body.error, 'ad_cooldown')

  // daily limit per placement (5 for gold)
  for (let i = 0; i < 4; i++) {
    await resetCooldown(u.profile.id)
    const s = await api('/me/ads/start', { token: u.token, method: 'POST', body: { placement: 'gold' } })
    await age(u.profile.id)
    assert.equal((await api('/me/ads/complete', { token: u.token, method: 'POST', body: { sessionId: s.body.sessionId } })).status, 200)
  }
  await resetCooldown(u.profile.id)
  assert.equal((await api('/me/ads/start', { token: u.token, method: 'POST', body: { placement: 'gold' } })).body.error, 'ad_limit')
  const booster = await api('/me/ads/start', { token: u.token, method: 'POST', body: { placement: 'booster' } })
  await age(u.profile.id)
  const b = await api('/me/ads/complete', { token: u.token, method: 'POST', body: { sessionId: booster.body.sessionId } })
  assert.equal(b.body.summary.boosters.radar, 1)
  // View logging is deliberately asynchronous to the reward response.
  let count=0
  for(let attempt=0;attempt<50;attempt++) {
    count=(await query('SELECT count(*)::int AS n FROM ad_views WHERE user_id = $1',[u.profile.id])).rows[0].n
    if(count===6) break
    await wait(20)
  }
  assert.equal(count,6)
})

test('double the last battle reward once', async () => {
  const u = await login('Doubler')
  assert.equal((await api('/me/ads/start', { token: u.token, method: 'POST', body: { placement: 'double' } })).body.error, 'nothing_to_double')
  const s = ioClient(BASE, { auth: { token: u.token }, transports: ['websocket'], forceNew: true })
  await new Promise((r) => s.on('connect', r))
  const call = (ev, d) => new Promise((r) => s.emit(ev, d, r))
  let over = null
  s.on('game:over', (o) => { over = o })
  await call('ai:start', { difficulty: 'hard' })
  await wait(50)
  await call('game:place', { ships: 'random' })
  await wait(50)
  await call('game:resign')
  for (let i = 0; i < 100 && !over; i++) await wait(20)
  const earned = over.rewards.gold
  assert.ok(earned > 0)
  const me = (await api('/me', { token: u.token })).body.profile
  assert.equal(me.ads.doubleGold, earned)
  const st = await api('/me/ads/start', { token: u.token, method: 'POST', body: { placement: 'double' } })
  await age(u.profile.id)
  const d = await api('/me/ads/complete', { token: u.token, method: 'POST', body: { sessionId: st.body.sessionId } })
  assert.equal(d.body.summary.gold, earned)
  assert.equal(d.body.profile.ads.doubleGold, 0)
  await resetCooldown(u.profile.id)
  assert.equal((await api('/me/ads/start', { token: u.token, method: 'POST', body: { placement: 'double' } })).body.error, 'nothing_to_double')
  s.close()
})

test('verified mode: reward only after the Adsgram callback', async () => {
  config.adsgramRewardSecret = 's3cret'
  try {
    const u = await login('Verified Viewer')
    await query('UPDATE users SET tg_id = 777001 WHERE id = $1', [u.profile.id])
    const s = await api('/me/ads/start', { token: u.token, method: 'POST', body: { placement: 'gold' } })
    await age(u.profile.id)
    assert.equal((await api('/me/ads/complete', { token: u.token, method: 'POST', body: { sessionId: s.body.sessionId } })).body.error, 'ad_not_confirmed')
    assert.equal((await api('/ads/adsgram-reward?userid=777001&secret=wrong')).status, 403)
    assert.equal((await api('/ads/adsgram-reward?userid=777001&secret=s3cret')).status, 200)
    const ok = await api('/me/ads/complete', { token: u.token, method: 'POST', body: { sessionId: s.body.sessionId } })
    assert.equal(ok.body.summary.gold, 100)
  } finally {
    config.adsgramRewardSecret = ''
  }
})
