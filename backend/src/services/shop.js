import { tx } from '../db.js'
import {
  findCosmetic, BOOSTERS, GOLD_EXCHANGE, findStarProduct, PASS_PREMIUM_GEMS, seasonId, DEFAULT_EQUIPPED,
} from '../../../shared/catalog.js'
import { mutateUser, grant, newSummary, checkAchievements, GameError } from './users.js'

function pay(user, price) {
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

function fulfill(user, p) {
  const summary = newSummary()
  if (p.kind === 'gems') grant(user, { gems: p.gems }, summary)
  else if (p.kind === 'bundle') grant(user, p.grant, summary)
  else if (p.kind === 'pass') user.data.pass.premium = true
  user.data.purchases[p.id] = (user.data.purchases[p.id] || 0) + 1
  checkAchievements(user, summary)
  return summary
}

/**
 * Idempotent: the same charge id is credited only once.
 * Returns { user, summary } or null if this charge was already processed.
 */
export async function completeStarPayment({ userId, productId, stars, chargeId, payload }) {
  return tx(async (client) => {
    const ins = await client.query(
      `INSERT INTO payments (user_id, product_id, stars, charge_id, payload) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (charge_id) DO NOTHING RETURNING id`,
      [userId, productId, stars, chargeId, payload || {}],
    )
    if (!ins.rows.length) return null
    const p = findStarProduct(productId)
    if (!p) throw new Error(`Unknown product ${productId}`)
    if (p.stars !== stars) throw new Error(`Price mismatch for ${productId}: ${stars}`)
    const { user, result } = await mutateUser(userId, (u) => fulfill(u, p), client)
    return { user, summary: result }
  })
}

/** Takes back what a purchase granted (as far as the balance allows). Returns what was removed. */
function revoke(user, p) {
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
    user.data.pass.premium = false
    out.pass = true
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
    if (!pay || pay.status !== 'paid') return null
    const p = findStarProduct(pay.product_id)
    const { user, result } = await mutateUser(Number(pay.user_id), (u) => (p ? revoke(u, p) : {}), client, { allowBanned: true })
    await client.query(`UPDATE payments SET status='refunded', refunded_at=now(), revoked=$2 WHERE id=$1`, [pay.id, result])
    return { payment: pay, revoked: result, user }
  })
}

/** Used when Telegram reports a refund made outside the admin panel */
export const markRefunded = (chargeId) => refundPayment({ chargeId })
