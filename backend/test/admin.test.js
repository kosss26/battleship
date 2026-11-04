import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'

const devId = (name) => 9_000_000_000 + (Math.abs([...name].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) | 0, 7)) % 1_000_000)

process.env.PORT = '5078'
process.env.NODE_ENV = 'test'
process.env.ALLOW_DEV_LOGIN = 'true'
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgres://bs:bs@localhost:5432/battleship_test'
process.env.TELEGRAM_BOT_TOKEN = ''
process.env.ADMIN_IDS = String(devId('Root Admin'))

const { start } = await import('../src/server.js')
const { query, closeDb } = await import('../src/db.js')
const { completeStarPayment } = await import('../src/services/shop.js')
const { io: ioClient } = await import('socket.io-client')

const BASE = 'http://localhost:5078'
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

before(async () => {
  srv = await start()
  await query('TRUNCATE admin_log, payments, games, users RESTART IDENTITY CASCADE')
})
after(async () => {
  srv.io.close()
  srv.httpServer.close()
  await closeDb()
  setTimeout(() => process.exit(0), 100).unref()
})

test('only listed admins see the panel and its API', async () => {
  const admin = await login('Root Admin')
  const player = await login('Plain Player')
  assert.equal(admin.profile.isAdmin, true)
  assert.equal(player.profile.isAdmin, false)
  for (const path of ['/admin/dashboard', '/admin/users', '/admin/payments', '/admin/log']) {
    assert.equal((await api(path, { token: player.token })).status, 403, path)
    assert.equal((await api(path)).status, 401, path)
  }
  const dash = await api('/admin/dashboard', { token: admin.token })
  assert.equal(dash.status, 200)
  assert.equal(dash.body.users.total, 2)
  assert.equal(dash.body.daily.length, 14)
})

test('search, adjust, ban', async () => {
  const admin = await login('Root Admin')
  const victim = await login('Cheater Joe')
  const found = (await api('/admin/users?q=cheater', { token: admin.token })).body.users
  assert.equal(found.length, 1)
  const id = found[0].id

  assert.equal((await api(`/admin/users/${id}/adjust`, { token: admin.token, method: 'POST', body: { changes: { gold: 100 } } })).body.error, 'reason_required')
  assert.equal((await api(`/admin/users/${id}/adjust`, { token: admin.token, method: 'POST', body: { changes: { gold: -99999 }, reason: 'x' } })).body.error, 'negative_gold')
  const adj = await api(`/admin/users/${id}/adjust`, {
    token: admin.token, method: 'POST',
    body: { changes: { gold: 1000, gems: 50, boosters: { radar: 3 }, grantCosmetics: ['ship_royal'], premiumPass: true }, reason: 'compensation' },
  })
  assert.equal(adj.status, 200)
  assert.equal(adj.body.profile.gold, 1500)
  assert.equal(adj.body.profile.boosters.radar, 5)
  assert.ok(adj.body.profile.owned.includes('ship_royal'))
  assert.equal(adj.body.profile.pass.premium, true)
  assert.equal(adj.body.log[0].action, 'adjust')

  // Admins cannot be banned, players can; banned players lose API and socket access
  const adminId = (await api('/admin/users?q=Root', { token: admin.token })).body.users[0].id
  assert.equal((await api(`/admin/users/${adminId}/ban`, { token: admin.token, method: 'POST', body: { banned: true } })).body.error, 'cannot_ban_admin')
  const ban = await api(`/admin/users/${id}/ban`, { token: admin.token, method: 'POST', body: { banned: true, reason: 'bot' } })
  assert.equal(ban.body.banned, true)
  assert.equal((await api('/me', { token: victim.token })).status, 403)
  const err = await new Promise((resolve) => {
    const s = ioClient(BASE, { auth: { token: victim.token }, transports: ['websocket'], forceNew: true, reconnection: false })
    s.on('connect', () => resolve('connected'))
    s.on('connect_error', (e) => resolve(e.message))
  })
  assert.equal(err, 'banned')
  await api(`/admin/users/${id}/ban`, { token: admin.token, method: 'POST', body: { banned: false } })
  assert.equal((await api('/me', { token: victim.token })).status, 200)
})

test('refund revokes purchased goods once', async () => {
  const admin = await login('Root Admin')
  const buyer = await login('Big Spender')
  await completeStarPayment({ userId: buyer.profile.id, productId: 'starter', stars: 99, chargeId: 'ch_1', payload: {} })
  const again = await completeStarPayment({ userId: buyer.profile.id, productId: 'starter', stars: 99, chargeId: 'ch_1', payload: {} })
  assert.equal(again, null, 'same charge credited only once')
  const before = (await api('/me', { token: buyer.token })).body.profile
  assert.equal(before.gems, 20 + 300)
  assert.ok(before.owned.includes('ship_camo'))

  const pays = (await api('/admin/payments', { token: admin.token })).body.payments
  assert.equal(pays.length, 1)
  const r = await api(`/admin/payments/${pays[0].id}/refund`, { token: admin.token, method: 'POST', body: { reason: 'test' } })
  assert.equal(r.status, 200)
  assert.equal(r.body.revoked.gems, 300)
  assert.deepEqual(r.body.revoked.cosmetics, ['ship_camo'])
  const after = (await api('/me', { token: buyer.token })).body.profile
  assert.equal(after.gems, 20)
  assert.ok(!after.owned.includes('ship_camo'))
  assert.equal(after.purchases.starter, undefined, 'starter pack can be bought again')
  assert.equal((await api(`/admin/payments/${pays[0].id}/refund`, { token: admin.token, method: 'POST' })).body.error, 'already_refunded')

  const log = (await api('/admin/log', { token: admin.token })).body.log
  assert.ok(log.some((l) => l.action === 'refund'))
  const dry = await api('/admin/broadcast', { token: admin.token, method: 'POST', body: { segment: 'payers', dryRun: true } })
  assert.equal(dry.body.recipients, 0, 'refunded buyer is no longer a payer')
})

test('analytics: retention cohorts, funnel and KPIs (admin only)', async () => {
  const admin = await login('Root Admin')
  const player = await login('Cohort Player')
  assert.equal((await api('/admin/analytics', { token: player.token })).status, 403)
  // A player who registered 8 days ago and came back on days 1 and 7
  await query(`UPDATE users SET created_at = now() - interval '8 days' WHERE id = $1`, [player.profile.id])
  await query(`DELETE FROM user_activity WHERE user_id = $1`, [player.profile.id])
  await query(
    `INSERT INTO user_activity (user_id, day) VALUES ($1, current_date - 8), ($1, current_date - 7), ($1, current_date - 1)`,
    [player.profile.id],
  )
  const a = (await api('/admin/analytics?days=30', { token: admin.token })).body
  assert.equal(a.days, 30)
  assert.equal(a.daily.length, 30)
  const cohort = a.cohorts.find((c) => c.size === 1 && c.d1 === 100)
  assert.ok(cohort, JSON.stringify(a.cohorts))
  assert.equal(cohort.d7, 100)
  assert.equal(cohort.d14, null, 'not mature yet')
  assert.ok(a.funnel.registered >= 2)
  assert.ok(a.funnel.returned >= 1)
  assert.ok(a.kpi.mau >= 2)
  assert.ok(Array.isArray(a.products))
})
