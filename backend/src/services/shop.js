import crypto from 'crypto'
import { tx, query } from '../db.js'
import {
  findCosmetic, BOOSTERS, GOLD_EXCHANGE, findStarProduct, PASS_PREMIUM_GEMS, seasonId, DEFAULT_EQUIPPED, collectionItems, collectionQuote,
} from '../../../shared/catalog.js'
import { mutateUser, grant, newSummary, checkAchievements, GameError } from './users.js'

function pay(user, price) {
  // Validate every currency before mutating either balance.
  if (price.gold && user.gold < price.gold) throw new GameError('not_enough_gold')
  if (price.gems && user.gems < price.gems) throw new GameError('not_enough_gems')
  if (price.gold) {
    if (user.gold < price.gold) throw new GameError('not_enough_gold')
    user.gold -= price.gold
  }
  if (price.gems) {
    if (user.gems < price.gems) throw new GameError('not_enough_gems')
    user.gems -= price.gems
  }
}

/** Purchases for soft/hard in-game currency */
export function buyItem(user, itemId, qty = 1) {
  const summary = newSummary()
  if (itemId.startsWith('collection:')) {
    const id=itemId.slice(11), all=collectionItems(id)
    if (!all.length || all.some(x=>!x?.item.price)) throw new GameError('item_not_found',404)
    const {items,price}=collectionQuote(id,user.data.owned)
    if (!items.length) throw new GameError('already_owned')
    pay(user,price)
    grant(user,{cosmetics:items.map(x=>x.item.id)},summary)
    checkAchievements(user,summary)
    return summary
  }
  if (itemId.startsWith('booster:')) {
    const b = BOOSTERS[itemId.slice(8)]
    const n = [1, 5, 10].includes(qty) ? qty : 1
    if (!b) throw new GameError('item_not_found', 404)
    // Bulk discount: 5 → -10%, 10 → -20%
    const mult = n === 10 ? 8 : n === 5 ? 4.5 : 1
    pay(user, { gold: Math.round(b.price.gold * mult) })
    grant(user, { boosters: { [b.id]: n } }, summary)
    return summary
  }
  if (itemId.startsWith('exchange:')) {
    const ex = GOLD_EXCHANGE.find((e) => e.id === itemId.slice(9))
    if (!ex) throw new GameError('item_not_found', 404)
    pay(user, { gems: ex.gems })
    grant(user, { gold: ex.gold }, summary)
    return summary
  }
  if (itemId === 'pass:premium') {
    if (user.data.pass.premium && user.data.pass.season === seasonId()) throw new GameError('already_owned')
    pay(user, { gems: PASS_PREMIUM_GEMS })
    user.data.pass.premium = true
    user.data.pass.premiumSource = 'gems'
    user.data.pass.premiumChargeId = null
    return summary
  }
  const found = findCosmetic(itemId)
  if (!found || !found.item.price) throw new GameError('item_not_found', 404)
  if (user.data.owned.includes(itemId)) throw new GameError('already_owned')
  pay(user, found.item.price)
  grant(user, { cosmetics: [itemId] }, summary)
  checkAchievements(user, summary)
  return summary
}

export function equip(user, itemId) {
  if (itemId.startsWith('collection:')) {
    const items=collectionItems(itemId.slice(11))
    if (!items.length) throw new GameError('item_not_found',404)
    if (items.some(x=>!user.data.owned.includes(x.item.id))) throw new GameError('not_owned')
    for (const {slot,item} of items) user.data.equipped[slot]=item.id
    return
  }
  const found = findCosmetic(itemId)
  if (!found) throw new GameError('item_not_found', 404)
  if (!user.data.owned.includes(itemId)) throw new GameError('not_owned')
  user.data.equipped[found.slot] = itemId
}

/* ───────── Telegram Stars ───────── */

export function validateStarPurchase(user, productId) {
  const p = findStarProduct(productId)
  if (!p) throw new GameError('item_not_found', 404)
  if (p.oncePerUser && user.data.purchases[p.id]) throw new GameError('already_owned')
  if (p.kind === 'pass' && user.data.pass.premium && user.data.pass.season === seasonId()) throw new GameError('already_owned')
  return p
}

function fulfill(user, p, chargeId) {
  const summary = newSummary()
  if (p.kind === 'gems') grant(user, { gems: p.gems }, summary)
  else if (p.kind === 'bundle') grant(user, p.grant, summary)
  else if (p.kind === 'pass') {
    user.data.pass.premium = true
    user.data.pass.premiumSource = 'stars'
    user.data.pass.premiumChargeId = chargeId
  }
  user.data.purchases[p.id] = (user.data.purchases[p.id] || 0) + 1
  checkAchievements(user, summary)
  return summary
}

/**
 * Idempotent: the same charge id is credited only once.
 * Returns { user, summary } or null if this charge was already processed.
 */
export async function createInvoiceRecord(user, productId) {
  const p = validateStarPurchase(user, productId)
  const id = crypto.randomUUID()
  await query(`INSERT INTO star_invoices(id,user_id,product_id,stars,season,product) VALUES($1,$2,$3,$4,$5,$6)`,
    [id, user.id, p.id, p.stars, p.kind === 'pass' ? seasonId() : null, p])
  return { id, product: p }
}

export async function invoiceProduct(payload, userId, { checkout = false } = {}, client = null) {
  let p, season
  if (payload?.i) {
    const { rows } = await (client || { query }).query('SELECT * FROM star_invoices WHERE id=$1 AND user_id=$2', [payload.i, userId])
    const inv = rows[0]
    if (!inv) throw new GameError('invoice_not_found')
    if (checkout && Date.now() - new Date(inv.created_at).getTime() > 24 * 60 * 60_000) throw new GameError('invoice_expired')
    p = inv.product; season = inv.season
  } else {
    // Existing invoices issued before the ledger migration remain payable.
    p = findStarProduct(payload?.p)
    season = p?.kind === 'pass' ? seasonId(payload?.t ? new Date(payload.t) : new Date()) : null
  }
  if (!p) throw new GameError('item_not_found')
  if (checkout && p.kind === 'pass' && season !== seasonId()) throw new GameError('invoice_expired')
  return { product: p, season }
}

export async function completeStarPayment({ userId, productId, stars, chargeId, payload = {}, buyerTgId = null }) {
  return tx(async client => {
    const { product: p, season } = await invoiceProduct({ ...payload, p: payload.p || productId }, userId, {}, client)
    if (p.stars !== stars) throw new Error(`Price mismatch for ${p.id}`)
    const entitlement = { product: p, season, delivered: true }
    const ins = await client.query(`INSERT INTO payments(user_id,product_id,stars,charge_id,payload,entitlement,buyer_tg_id)
      VALUES($1,$2,$3,$4,$5,$6,COALESCE($7::bigint,(SELECT tg_id FROM users WHERE id=$1))) ON CONFLICT(charge_id) DO NOTHING RETURNING id`,
      [userId,p.id,stars,chargeId,payload,entitlement,buyerTgId])
    if (!ins.rows.length) return null
    // Delivery and refund webhooks can arrive out of order.
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [chargeId])
    const alreadyRefunded = (await client.query('SELECT 1 FROM payment_refund_notices WHERE charge_id=$1', [chargeId])).rows.length > 0
    let refundPending = false
    const { user, result } = await mutateUser(userId, u => {
      refundPending = (p.kind === 'pass' && (season !== seasonId() || u.data.pass.premium))
        || (p.oncePerUser && !!u.data.purchases[p.id])
        || !!u.data.deletedAt || (buyerTgId != null && Number(u.tg_id) !== Number(buyerTgId))
      if (alreadyRefunded) return null
      if (refundPending) return null
      return fulfill(u, p, chargeId)
    }, client, { allowBanned: true })
    if (refundPending || alreadyRefunded) await client.query(`UPDATE payments SET status=$2,
      refund_requested_at=CASE WHEN $2='refund_pending' THEN now() ELSE NULL END,
      entitlement=jsonb_set(entitlement,'{delivered}','false') WHERE id=$1`, [ins.rows[0].id, alreadyRefunded ? 'refunded' : 'refund_pending'])
    return { user, summary: result, refundPending, refunded: alreadyRefunded }
  })
}

export async function queueRefund(id) {
  const { rows } = await query(`UPDATE payments SET status='refund_pending', refund_requested_at=now() WHERE id=$1 AND status='paid' RETURNING id`, [id])
  return !!rows.length
}

/** Takes back what a purchase granted (as far as the balance allows). Returns what was removed. */
function revoke(user, p, pay) {
  const out = { gems: 0, gold: 0, boosters: {}, cosmetics: [], pass: false, shortfall: {} }
  const take = (key, amount) => {
    const n = Math.min(user[key], amount)
    user[key] -= n
    out[key] += n
    if (n < amount) out.shortfall[key] = amount - n
  }
  if (p.kind === 'gems') take('gems', p.gems)
  if (p.kind === 'bundle') {
    take('gems', p.grant.gems || 0)
    take('gold', p.grant.gold || 0)
    for (const [id, n] of Object.entries(p.grant.boosters || {})) {
      const have = user.data.boosters[id] || 0
      user.data.boosters[id] = Math.max(0, have - n)
      out.boosters[id] = Math.min(have, n)
    }
    for (const id of p.grant.cosmetics || []) {
      if (!user.data.owned.includes(id)) continue
      user.data.owned = user.data.owned.filter((x) => x !== id)
      out.cosmetics.push(id)
      const found = findCosmetic(id)
      if (found && user.data.equipped[found.slot] === id) user.data.equipped[found.slot] = DEFAULT_EQUIPPED[found.slot]
    }
  }
  if (p.kind === 'pass') {
    const boughtSeason = pay.entitlement?.season || seasonId(new Date(pay.payload?.t || pay.created_at))
    const pass = user.data.pass
    if (pass.season === boughtSeason && (!pass.premiumSource || pass.premiumSource === 'stars')
      && (!pass.premiumChargeId || pass.premiumChargeId === pay.charge_id)) {
      pass.premium = false
      out.pass = true
    }
  }
  if (user.data.purchases[p.id]) {
    user.data.purchases[p.id]--
    if (!user.data.purchases[p.id]) delete user.data.purchases[p.id]
  }
  return out
}

/**
 * Marks a payment refunded and revokes its goods. Idempotent: only 'paid' rows are processed.
 * Returns { payment, revoked, user } or null if nothing to do.
 */
export async function refundPayment({ id, chargeId }) {
  return tx(async (client) => {
    const { rows } = await client.query(
      `SELECT * FROM payments WHERE ${id ? 'id = $1' : 'charge_id = $1'} FOR UPDATE`,
      [id || chargeId],
    )
    const pay = rows[0]
    if (!pay || !['paid', 'refund_pending'].includes(pay.status)) return null
    const p = pay.entitlement?.product || findStarProduct(pay.product_id)
    const { user, result } = await mutateUser(Number(pay.user_id), (u) => (p && pay.entitlement?.delivered !== false ? revoke(u, p, pay) : {}), client, { allowBanned: true, touch: false })
    await client.query(`UPDATE payments SET status='refunded', refunded_at=now(), revoked=$2 WHERE id=$1`, [pay.id, result])
    return { payment: pay, revoked: result, user }
  })
}

/** Used when Telegram reports a refund made outside the admin panel */
export async function markRefunded(chargeId) {
  await tx(async client => {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [chargeId])
    await client.query('INSERT INTO payment_refund_notices(charge_id) VALUES($1) ON CONFLICT DO NOTHING', [chargeId])
  })
  return refundPayment({ chargeId })
}
