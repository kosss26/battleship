import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { spawn } from 'node:child_process'

process.env.PORT = '5082'
process.env.NODE_ENV = 'test'
process.env.BOT_FAST = '1'
process.env.ALLOW_DEV_LOGIN = 'true'
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgres://bs:bs@localhost:5432/battleship_test'
process.env.TELEGRAM_BOT_TOKEN = ''

const { start } = await import('../src/server.js')
const { query, tx, closeDb, migrate } = await import('../src/db.js')
const { GameRoom } = await import('../src/game/room.js')
const { persistRoom, settleRoom, latestResult, dismissResult, readSavedRoom } = await import('../src/game/persistence.js')
const { getUser, mutateUser, publicProfile, deleteAccount } = await import('../src/services/users.js')
const { createInvoiceRecord, invoiceProduct, completeStarPayment, refundPayment, queueRefund, markRefunded } = await import('../src/services/shop.js')
const { processPendingRefunds, processRefund } = await import('../src/services/refunds.js')
const { config } = await import('../src/config.js')
const { prevSeasonId, seasonId } = await import('../../shared/catalog.js')
const { io } = await import('socket.io-client')

const base = 'http://localhost:5082'
let server
const sockets = []
const wait = ms => new Promise(r => setTimeout(r, ms))
async function until(fn) {
  for (let i = 0; i < 500; i++) { if (fn()) return; await wait(20) }
  throw new Error('timeout')
}
async function login(name) {
  return fetch(`${base}/api/auth/dev`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name }) }).then(r => r.json())
}
async function connect(token, origin = base) {
  const s = io(origin, { auth: { token }, transports: ['websocket'], forceNew: true, reconnection: false })
  sockets.push(s)
  s.on('game:state', st => { s.state = st })
  s.on('game:over', result => { s.over = result })
  await new Promise((resolve, reject) => { s.on('connect', resolve); s.on('connect_error', reject) })
  return s
}
const call = (s, event, data = {}) => new Promise(resolve => s.emit(event, data, resolve))
before(async () => {
  await migrate()
  await query('TRUNCATE game_rooms, match_notifications, users RESTART IDENTITY CASCADE')
  server = await start()
})
after(async () => {
  await server?.stop()
  for (const s of sockets) s.close()
  await closeDb()
})

test('a real socket battle survives server restart, hides fleets, and resumes the same shot history', async () => {
  const a = await login('Recovery Alice'), b = await login('Recovery Bob')
  const sa = await connect(a.token), sb = await connect(b.token)
  const { code } = await call(sa, 'duel:create')
  await call(sb, 'duel:join', { code })
  await until(() => sa.state && sb.state)
  await call(sa, 'game:place', { ships: 'random' })
  await call(sb, 'game:place', { ships: 'random' })
  await until(() => sa.state.phase === 'battle' && sb.state.phase === 'battle')
  const shooter = sa.state.myTurn ? sa : sb
  const answers = await Promise.all([call(shooter, 'game:fire', { r: 0, c: 0 }), call(shooter, 'game:fire', { r: 0, c: 0 })])
  assert.equal(answers.filter(r => r.ok).length, 1)
  const saved = structuredClone(sa.state)
  await server.stop()
  sa.close(); sb.close()
  server = await start()
  const ra = await connect(a.token)
  await until(() => ra.state?.recovering)
  assert.equal(ra.state.myTurn, false)
  assert.equal(ra.state.opp.ships, null)
  const rb = await connect(b.token)
  await until(() => ra.state && rb.state && !ra.state.recovering && !rb.state.recovering)
  assert.equal(ra.state.id, saved.id)
  assert.deepEqual(ra.state.me.shots, saved.me.shots)
  assert.deepEqual(ra.state.opp.shots, saved.opp.shots)
  assert.deepEqual(ra.state.me.ships, saved.me.ships)
  assert.equal(ra.state.myTurn, saved.myTurn)
  await call(ra, 'game:resign')
  await until(() => ra.over && rb.over)
  assert.equal((await query('SELECT count(*)::int AS n FROM games WHERE id=$1', [saved.id])).rows[0].n, 1)
  // Result delivery also survives disconnects and is dismissed only by its owner.
  assert.ok(await latestResult(a.profile.id))
  await dismissResult(b.profile.id, saved.id)
  assert.ok(await latestResult(a.profile.id))
  await dismissResult(a.profile.id, saved.id)
  assert.equal(await latestResult(a.profile.id), undefined)
  ra.close(); rb.close()
})

async function durableDuel(a, b) {
  const room = new GameRoom({ mode: 'ranked', seats: [a, b].map(u => ({ kind: 'human', userId: u.id, profile: publicProfile(u) })),
    hooks: { emit() {}, onFinish() {}, transaction: tx, persist: persistRoom } })
  await room.run(() => {})
  await room.run(() => room.place(a.id, 'random'))
  await room.run(() => room.place(b.id, 'random'))
  return room
}

test('history failure rolls back BOTH rewards and retry settles exactly once, even concurrently', async () => {
  const a = await login('Atomic Alice'), b = await login('Atomic Bob')
  const room = await durableDuel(await getUser(a.profile.id), await getUser(b.profile.id))
  await room.run(() => room.finish(0, 'victory'))
  const before = await getUser(a.profile.id)
  await query(`CREATE FUNCTION reject_history_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected history failure'; END $$`)
  await query(`CREATE TRIGGER reject_history_test BEFORE INSERT ON games FOR EACH ROW EXECUTE FUNCTION reject_history_test()`)
  try {
    await assert.rejects(settleRoom(room), /injected history failure/)
    assert.equal((await getUser(a.profile.id)).gold, before.gold)
    assert.equal((await getUser(a.profile.id)).games, 0)
    assert.equal((await getUser(b.profile.id)).games, 0)
    assert.equal((await query('SELECT count(*)::int AS n FROM game_room_players WHERE room_id=$1', [room.id])).rows[0].n, 2)
  } finally { await query('DROP TRIGGER reject_history_test ON games; DROP FUNCTION reject_history_test()') }
  const [first, second] = await Promise.all([settleRoom(room), settleRoom(room)])
  assert.deepEqual(first, second)
  assert.equal((await getUser(a.profile.id)).games, 1)
  assert.equal((await getUser(b.profile.id)).games, 1)
  assert.equal((await query('SELECT count(*)::int AS n FROM games WHERE id=$1', [room.id])).rows[0].n, 1)
  room.dispose()
})

test('snapshot failure rolls back a consumed booster and publishes no uncommitted shot', async () => {
  const a = await login('Booster Alice'), b = await login('Booster Bob')
  const room = await durableDuel(await getUser(a.profile.id), await getUser(b.profile.id))
  room.mode = 'ai'
  room.turn = 0
  const before = room.serialize()
  const inventory = (await getUser(a.profile.id)).data.boosters.radar
  const events = []
  room.hooks.emit = (...ev) => events.push(ev)
  room.hooks.persist = async () => { throw new Error('injected snapshot failure') }
  await assert.rejects(room.run(c => room.useBooster(a.profile.id, 'radar', 0, 0, async () => {
    await mutateUser(a.profile.id, u => { u.data.boosters.radar-- }, c)
  })), /injected snapshot failure/)
  assert.equal((await getUser(a.profile.id)).data.boosters.radar, inventory)
  assert.deepEqual(room.seats[0].scans, before.seats[0].scans)
  assert.equal(events.length, 0)
  room.dispose()
  await query('DELETE FROM game_rooms WHERE id=$1', [room.id])
})

test('a lost COMMIT acknowledgement reloads the committed booster state instead of overwriting it', async () => {
  const a = await login('Commit Alice'), b = await login('Commit Bob')
  const room = await durableDuel(await getUser(a.profile.id), await getUser(b.profile.id))
  room.mode = 'ai'; room.turn = 0
  room.hooks.load = readSavedRoom
  room.hooks.transaction = async fn => { await tx(fn); throw new Error('lost commit acknowledgement') }
  const before = (await getUser(a.profile.id)).data.boosters.radar
  await assert.rejects(room.run(c => room.useBooster(a.profile.id, 'radar', 0, 0, async () => {
    await mutateUser(a.profile.id, u => { u.data.boosters.radar-- }, c)
  })), /lost commit acknowledgement/)
  assert.equal((await getUser(a.profile.id)).data.boosters.radar, before - 1)
  assert.equal(room.seats[0].boostersUsed, 1)
  assert.equal(room.seats[0].scans.length, 1)
  room.hooks.transaction = tx
  await room.run(() => {})
  assert.equal((await readSavedRoom(room.id)).state.seats[0].scans.length, 1)
  room.dispose()
  await query('DELETE FROM game_rooms WHERE id=$1', [room.id])
})

test('a second restart while waiting retains the paused turn and hidden-information state', async () => {
  const a = await login('Paused Alice'), b = await login('Paused Bob')
  const room = await durableDuel(await getUser(a.profile.id), await getUser(b.profile.id))
  room.seats[0].missAt.set(44, 2)
  room.seats[0].haloHidden.add(45)
  room.deadline = Date.now() + 20_000
  room.recover(Date.now())
  const paused = room.recoveryRemaining
  const state = room.serialize()
  const restored = new GameRoom({ ...state, restored: state, hooks: { emit() {}, onFinish() {} } })
  restored.recover(Date.now() + 120_000)
  assert.equal(restored.recoveryRemaining, paused)
  assert.equal(restored.seats[0].missAt.get(44), 2)
  assert.equal(restored.seats[0].haloHidden.has(45), true)
  room.dispose(); restored.dispose()
  await query('DELETE FROM game_rooms WHERE id=$1', [room.id])
})

test('an unmatched recovered battle cancels without rating changes, rewards or losses', async () => {
  const a = await login('Void Alice'), b = await login('Void Bob')
  const room = await durableDuel(await getUser(a.profile.id), await getUser(b.profile.id))
  room.recover(Date.now())
  assert.equal(room.snapshot(0).myTurn, false)
  await room.run(() => room.resign(a.profile.id))
  const result = await settleRoom(room)
  assert.equal(room.result.reason, 'server_restart')
  assert.deepEqual(result.rewards, [null, null])
  for (const u of [a, b]) {
    const after = await getUser(u.profile.id)
    assert.equal(after.rating, 1000)
    assert.equal(after.games, 0)
  }
  room.dispose()
})

test('refund of an old-season pass does not revoke the newly purchased season', async () => {
  const a = await login('Season Buyer')
  const old = crypto.randomUUID(), current = crypto.randomUUID()
  await completeStarPayment({ userId: a.profile.id, productId: 'pass_premium', stars: 299, chargeId: old })
  await query(`UPDATE payments SET entitlement=jsonb_set(entitlement,'{season}',to_jsonb($2::text)) WHERE charge_id=$1`, [old, prevSeasonId()])
  await mutateUser(a.profile.id, u => { u.data.pass.premium = false })
  await completeStarPayment({ userId: a.profile.id, productId: 'pass_premium', stars: 299, chargeId: current })
  await refundPayment({ chargeId: old })
  const u = await getUser(a.profile.id)
  assert.equal(u.data.pass.premium, true)
  assert.equal(u.data.pass.premiumChargeId, current)
})

test('late payment for an expired invoice is durably queued for refund and safely retried', async () => {
  const a = await login('Late Buyer')
  const inv = await createInvoiceRecord(await getUser(a.profile.id), 'pass_premium')
  await query('UPDATE star_invoices SET season=$2 WHERE id=$1', [inv.id, prevSeasonId()])
  const payload = { i: inv.id, p: 'pass_premium', u: a.profile.id }
  await assert.rejects(invoiceProduct(payload, a.profile.id, { checkout: true }), /invoice_expired/)
  const chargeId = crypto.randomUUID()
  const result = await completeStarPayment({ userId: a.profile.id, stars: 299, chargeId, payload })
  assert.equal(result.refundPending, true)
  assert.equal((await getUser(a.profile.id)).data.pass.premium, false)
  assert.equal((await query('SELECT status FROM payments WHERE charge_id=$1', [chargeId])).rows[0].status, 'refund_pending')
  assert.equal(await completeStarPayment({ userId: a.profile.id, stars: 299, chargeId, payload }), null)
  await processPendingRefunds()
  await processPendingRefunds()
  assert.equal((await query('SELECT status FROM payments WHERE charge_id=$1', [chargeId])).rows[0].status, 'refunded')
})

test('invoice ownership, price and duplicate one-time purchases are checked at fulfillment', async () => {
  const a = await login('Invoice Alice'), b = await login('Invoice Bob')
  const inv = await createInvoiceRecord(await getUser(a.profile.id), 'starter')
  await assert.rejects(invoiceProduct({ i: inv.id }, b.profile.id), /invoice_not_found/)
  await assert.rejects(completeStarPayment({ userId: a.profile.id, stars: 1, chargeId: crypto.randomUUID(), payload: { i: inv.id } }), /Price mismatch/)
  const chargeId = crypto.randomUUID()
  const first = await completeStarPayment({ userId: a.profile.id, stars: 99, chargeId, payload: { i: inv.id } })
  assert.equal(first.refundPending, false)
  const gems = (await getUser(a.profile.id)).gems
  const second = await completeStarPayment({ userId: a.profile.id, stars: 99, chargeId: crypto.randomUUID(), payload: { i: inv.id } })
  assert.equal(second.refundPending, true)
  assert.equal((await getUser(a.profile.id)).gems, gems)
  assert.equal((await getUser(a.profile.id)).data.pass.season, seasonId())
})

test('refund before payment delivery cannot later grant the refunded goods', async () => {
  const a = await login('Out Of Order Buyer')
  const chargeId = crypto.randomUUID()
  await markRefunded(chargeId)
  const result = await completeStarPayment({ userId: a.profile.id, productId: 'gems_80', stars: 50, chargeId })
  assert.equal(result.refunded, true)
  assert.equal((await getUser(a.profile.id)).gems, 20)
})

test('Telegram failure keeps refund pending; already-refunded retry revokes goods exactly once', async () => {
  const a = await login('Refund Retry Buyer')
  const chargeId = crypto.randomUUID()
  await completeStarPayment({ userId: a.profile.id, productId: 'gems_80', stars: 50, chargeId })
  const id = Number((await query('SELECT id FROM payments WHERE charge_id=$1', [chargeId])).rows[0].id)
  await queueRefund(id)
  const originalFetch = globalThis.fetch, originalToken = config.botToken
  try {
    config.botToken = 'test-only-no-network'
    globalThis.fetch = async () => new Response(JSON.stringify({ ok: false, description: 'Temporary outage' }))
    await assert.rejects(processRefund(id), /Temporary outage/)
    assert.equal((await getUser(a.profile.id)).gems, 100)
    assert.equal((await query('SELECT status FROM payments WHERE id=$1', [id])).rows[0].status, 'refund_pending')
    globalThis.fetch = async () => new Response(JSON.stringify({ ok: false, description: 'CHARGE_ALREADY_REFUNDED' }))
    await processRefund(id)
    await processRefund(id)
    assert.equal((await getUser(a.profile.id)).gems, 20)
    assert.equal((await query('SELECT status FROM payments WHERE id=$1', [id])).rows[0].status, 'refunded')
  } finally { globalThis.fetch = originalFetch; config.botToken = originalToken }
})

test('a payment webhook is acknowledged only after commit; Telegram retry credits exactly once', async () => {
  const a = await login('Webhook Buyer'), buyer = await getUser(a.profile.id)
  const chargeId = crypto.randomUUID()
  const body = { message: { from: { id: buyer.tg_id }, chat: { id: buyer.tg_id }, successful_payment: {
    invoice_payload: JSON.stringify({ u: buyer.id, p: 'gems_80', t: Date.now() }),
    currency: 'XTR', total_amount: 50, telegram_payment_charge_id: chargeId,
  } } }
  const previous = config.webhookSecret
  config.webhookSecret = 'test-only-webhook-secret'
  const send = secret => fetch(`${base}/api/telegram/webhook`, { method: 'POST',
    headers: { 'content-type': 'application/json', 'X-Telegram-Bot-Api-Secret-Token': secret }, body: JSON.stringify(body) })
  try {
    assert.equal((await send('wrong')).status, 401)
    await query(`CREATE FUNCTION reject_payment_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected payment failure'; END $$`)
    await query(`CREATE TRIGGER reject_payment_test BEFORE INSERT ON payments FOR EACH ROW EXECUTE FUNCTION reject_payment_test()`)
    try {
      assert.equal((await send(config.webhookSecret)).status, 500)
      assert.equal((await getUser(buyer.id)).gems, 20)
    } finally { await query('DROP TRIGGER reject_payment_test ON payments; DROP FUNCTION reject_payment_test()') }
    assert.equal((await send(config.webhookSecret)).status, 200)
    assert.equal((await send(config.webhookSecret)).status, 200)
    assert.equal((await getUser(buyer.id)).gems, 100)
  } finally { config.webhookSecret = previous }
})

test('a paid invoice arriving after account deletion refunds its real payer instead of disappearing', async () => {
  const a = await login('Deleted Invoice Buyer'), buyer = await getUser(a.profile.id)
  const inv = await createInvoiceRecord(buyer, 'gems_80')
  await deleteAccount(buyer.id)
  const chargeId = crypto.randomUUID()
  const response = await fetch(`${base}/api/telegram/webhook`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: {
    from: { id: buyer.tg_id }, chat: { id: buyer.tg_id }, successful_payment: {
      currency: 'XTR', total_amount: 50, telegram_payment_charge_id: chargeId,
      invoice_payload: JSON.stringify({ u: buyer.id, p: 'gems_80', i: inv.id }),
    },
  } }) })
  assert.equal(response.status, 200)
  const payment = (await query('SELECT * FROM payments WHERE charge_id=$1', [chargeId])).rows[0]
  assert.equal(payment.status, 'refund_pending')
  assert.equal(Number(payment.buyer_tg_id), buyer.tg_id)
  assert.equal((await getUser(buyer.id)).gems, 20)
  await processPendingRefunds()
  assert.equal((await query('SELECT status FROM payments WHERE charge_id=$1', [chargeId])).rows[0].status, 'refunded')
})

test('startup settles a durable unfinished outcome and repeated startup does not award twice', async () => {
  const a = await login('Pending Alice'), b = await login('Pending Bob')
  const room = await durableDuel(await getUser(a.profile.id), await getUser(b.profile.id))
  await room.run(() => room.finish(0, 'victory'))
  room.dispose()
  assert.equal((await getUser(a.profile.id)).games, 0)
  await server.stop()
  server = await start()
  assert.equal((await getUser(a.profile.id)).games, 1)
  assert.equal((await getUser(b.profile.id)).games, 1)
  await server.stop()
  server = await start()
  assert.equal((await getUser(a.profile.id)).games, 1)
})

test('SIGKILL preserves acknowledged shots; a separate new process recovers the actual database snapshot', async () => {
  await server.stop()
  let child
  const origin = 'http://localhost:5083'
  const childStart = async () => {
    child = spawn(process.execPath, ['src/index.js'], { cwd: new URL('../', import.meta.url),
      env: { ...process.env, PORT: '5083' }, stdio: ['ignore', 'ignore', 'pipe'] })
    let ready = false
    for (let i = 0; i < 100; i++) {
      ready = await fetch(`${origin}/api/ready`).then(r => r.ok).catch(() => false)
      if (ready) break
      await wait(50)
    }
    assert.ok(ready, 'child backend ready')
  }
  try {
    await childStart()
    const a = await fetch(`${origin}/api/auth/dev`, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Crash Alice' }) }).then(r => r.json())
    const s = await connect(a.token, origin)
    await call(s, 'ai:start', { difficulty: 'easy' })
    await until(() => s.state?.phase === 'placement')
    await call(s, 'game:place', { ships: 'random' })
    await until(() => s.state?.myTurn)
    assert.equal((await call(s, 'game:fire', { r: 0, c: 0 })).ok, true)
    const id = s.state.id
    const exited = new Promise(resolve => child.once('exit', resolve))
    child.kill('SIGKILL')
    await exited
    s.close()
    const saved = (await query('SELECT state FROM game_rooms WHERE id=$1', [id])).rows[0].state
    assert.equal(saved.seats[0].shots, 1)
    await childStart()
    const restored = await connect(a.token, origin)
    await until(() => restored.state?.id === id && !restored.state.recovering)
    assert.equal(restored.state.me.stats.shots, 1)
    assert.deepEqual(restored.state.opp.shots, saved.seats[1].board.shots)
    assert.equal(restored.state.opp.ships, null)
    restored.close()
  } finally {
    if (child && child.exitCode === null && child.signalCode === null) {
      const exited = new Promise(resolve => child.once('exit', resolve))
      child.kill('SIGTERM'); await exited
    }
    server = await start()
  }
})
