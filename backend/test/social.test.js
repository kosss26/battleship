import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'

process.env.PORT = '5079'
process.env.NODE_ENV = 'test'
process.env.BOT_FAST = '1'
process.env.ALLOW_DEV_LOGIN = 'true'
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgres://bs:bs@localhost:5432/battleship_test'
process.env.TELEGRAM_BOT_TOKEN = ''

const { start } = await import('../src/server.js')
const { query, closeDb } = await import('../src/db.js')
const { sent, pickReminder, runReminders } = await import('../src/services/notify.js')
const { io: ioClient } = await import('socket.io-client')

const BASE = 'http://localhost:5079'
let srv

const api = async (path, { token, method = 'GET', body } = {}) => {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: res.status, body: await res.json() }
}
const login = async (name, ref) => (await api('/auth/dev', { method: 'POST', body: { name, ref } })).body
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
function connect(token) {
  const s = ioClient(BASE, { auth: { token }, transports: ['websocket'], forceNew: true })
  s.events = []
  s.onAny((ev, payload) => s.events.push([ev, payload]))
  return new Promise((resolve, reject) => {
    s.on('connect', () => resolve(s))
    s.on('connect_error', reject)
  })
}
const call = (s, ev, data) => new Promise((r) => s.emit(ev, data, r))

before(async () => {
  srv = await start()
  await query('TRUNCATE friendships, admin_log, payments, games, users RESTART IDENTITY CASCADE')
})
after(async () => {
  srv.io.close()
  srv.httpServer.close()
  await closeDb()
  setTimeout(() => process.exit(0), 100).unref()
})

test('friend requests, presence and notifications', async () => {
  const a = await login('Alpha')
  const b = await login('Bravo')
  assert.equal((await api('/me/friends', { method: 'POST', token: a.token, body: { id: a.profile.id } })).body.error, 'cannot_add_self')
  assert.equal((await api('/me/friends', { method: 'POST', token: a.token, body: { id: 99999 } })).body.error, 'user_not_found')

  const req = await api('/me/friends', { method: 'POST', token: a.token, body: { id: b.profile.id } })
  assert.equal(req.body.status, 'requested')
  assert.equal(req.body.outgoing.length, 1)
  assert.equal((await api('/me/friends', { method: 'POST', token: a.token, body: { id: b.profile.id } })).body.error, 'already_requested')
  // B is offline → gets a bot message
  assert.ok(sent.some((m) => m.userId === b.profile.id && m.kind === 'friend_request'))

  const bList = (await api('/me/friends', { token: b.token })).body
  assert.equal(bList.incoming.length, 1)
  const acc = await api(`/me/friends/${a.profile.id}/accept`, { method: 'POST', token: b.token })
  assert.equal(acc.body.friends.length, 1)
  assert.equal(acc.body.friends[0].online, false)

  const sa = await connect(a.token)
  await wait(100)
  const presence = (await api('/me/friends', { token: b.token })).body.friends[0]
  assert.equal(presence.online, true)

  const lb = (await api('/leaderboard?type=friends', { token: b.token })).body
  assert.equal(lb.entries.length, 2)

  await api(`/me/friends/${a.profile.id}`, { method: 'DELETE', token: b.token })
  assert.equal((await api('/me/friends', { token: a.token })).body.friends.length, 0)
  sa.close()
})

test('challenge a friend to a duel', async () => {
  const a = await login('Charlie')
  const b = await login('Delta')
  const sa = await connect(a.token)
  const sb = await connect(b.token)
  assert.equal((await call(sa, 'duel:invite', { friendId: b.profile.id })).error, 'not_friends')
  await api('/me/friends', { method: 'POST', token: a.token, body: { id: b.profile.id } })
  await wait(50)
  assert.ok(sb.events.some(([ev]) => ev === 'friend:request'), 'online friend gets a realtime request')
  await api(`/me/friends/${a.profile.id}/accept`, { method: 'POST', token: b.token })

  const inv = await call(sa, 'duel:invite', { friendId: b.profile.id })
  assert.match(inv.code, /^\d{5}$/)
  assert.equal((await call(sa, 'duel:invite', { friendId: b.profile.id })).error, 'invite_cooldown')
  // Hosting page asks for the duel again → same code
  assert.equal((await call(sa, 'duel:create')).code, inv.code)
  await wait(50)
  const ev = sb.events.find(([e]) => e === 'duel:invite')
  assert.equal(ev[1].code, inv.code)
  assert.ok(!sent.some((m) => m.userId === b.profile.id && m.kind === 'duel_invite'), 'online friend gets no bot spam')

  await call(sb, 'duel:decline', { code: inv.code })
  await wait(50)
  assert.ok(sa.events.some(([e]) => e === 'duel:declined'))
  const j = await call(sb, 'duel:join', { code: inv.code })
  assert.ok(j.room)
  sa.close()
  sb.close()
})

test('invited players become friends; inviter is notified after first battle', async () => {
  const host = await login('Echo')
  const guest = await login('Foxtrot', host.profile.refCode)
  const fr = (await api('/me/friends', { token: guest.token })).body.friends
  assert.equal(fr[0]?.id, host.profile.id)
  const s = await connect(guest.token)
  await call(s, 'ai:start', { difficulty: 'easy' })
  await wait(100)
  await call(s, 'game:place', { ships: 'random' })
  await wait(100)
  await call(s, 'game:resign')
  await wait(400)
  assert.ok(sent.some((m) => m.userId === host.profile.id && m.kind === 'referral_joined'))
  s.close()
})

test('reminder rules', async () => {
  const noon = new Date('2026-05-10T12:00:00Z')
  const evening = new Date('2026-05-10T17:00:00Z')
  const base = { id: 1, tg_id: 1, language: 'ru', first_name: 'A' }
  const mk = (data, hoursIdle) => ({ ...base, data, last_seen: new Date(noon - hoursIdle * 3600_000).toISOString() })

  assert.equal(pickReminder(mk({ daily: { last: '2026-05-09', streak: 4 } }, 22), evening).kind, 'streak_risk')
  assert.equal(pickReminder(mk({ daily: { last: '2026-05-08', streak: 4 } }, 30), noon).kind, 'daily_ready')
  assert.equal(pickReminder(mk({ daily: {} }, 80), noon).kind, 'comeback3')
  assert.equal(pickReminder(mk({ daily: {} }, 170), noon).kind, 'comeback7')
  assert.equal(pickReminder(mk({ daily: {}, settings: { notify: false } }, 80), noon), null, 'opted out')
  assert.equal(pickReminder(mk({ daily: {}, notifyState: { blocked: true } }, 80), noon), null, 'bot blocked')
  assert.equal(pickReminder(mk({ daily: {}, notifyState: { lastAuto: noon - 3600_000 } }, 80), noon), null, 'one per day')
  assert.equal(pickReminder(mk({ daily: {} }, 80), new Date('2026-05-10T23:00:00Z')), null, 'not at night')
  assert.equal(pickReminder(mk({ daily: {} }, 80), noon, () => true), null, 'not while online')

  // Scheduler marks lastAuto so the same user isn't reminded twice
  const u = await login('Golf')
  await query(`UPDATE users SET tg_id = 555, last_seen = now() - interval '80 hours' WHERE id = $1`, [u.profile.id])
  const n1 = await runReminders(() => false, new Date(new Date().setUTCHours(12)))
  const n2 = await runReminders(() => false, new Date(new Date().setUTCHours(12)))
  assert.ok(n1 >= 1)
  assert.equal(n2, 0)
})
