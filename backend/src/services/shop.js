import { query, tx } from '../db.js'
import {
  findCosmetic, BOOSTERS, GOLD_EXCHANGE, findStarProduct, PASS_PREMIUM_GEMS, seasonId,
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

export async function markRefunded(chargeId) {
  await query(`UPDATE payments SET status='refunded' WHERE charge_id=$1`, [chargeId])
}
