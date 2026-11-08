import { query } from '../db.js'
import { config } from '../config.js'
import { botApi } from '../telegram.js'
import { refundPayment } from './shop.js'

const processing = new Map()
export async function processRefund(id) {
  if (processing.has(id)) return processing.get(id)
  const task = (async () => {
    const { rows } = await query(`SELECT p.*,COALESCE(p.buyer_tg_id,u.tg_id) AS tg_id FROM payments p JOIN users u ON u.id=p.user_id
      WHERE p.id=$1 AND p.status='refund_pending'`, [id])
    const p = rows[0]
    if (!p) return null
    if (config.botToken) {
      if (!p.tg_id) throw new Error('Payer identity is unavailable; payment support review required')
      try { await botApi('refundStarPayment', { user_id: Number(p.tg_id), telegram_payment_charge_id: p.charge_id }) }
      catch (e) { if (!/CHARGE_ALREADY_REFUNDED|PAYMENT_ALREADY_REFUNDED/i.test(e.message)) throw e }
    } else if (config.isProd) throw new Error('Refund needs a configured bot')
    return refundPayment({ id })
  })()
  processing.set(id, task)
  try { return await task } finally { processing.delete(id) }
}

export async function processPendingRefunds() {
  const { rows } = await query(`SELECT id FROM payments WHERE status='refund_pending' ORDER BY id LIMIT 50`)
  for (const p of rows) {
    try { await processRefund(Number(p.id)) }
    catch (e) { console.error('[refund-pending]', p.id, e.message) }
  }
}

export function startRefundScheduler() {
  let current = null
  const tick = () => {
    if (!current) current = processPendingRefunds().catch(e => console.error('[refund-worker]', e.message)).finally(() => { current = null })
  }
  tick()
  const timer = setInterval(tick, 30_000).unref()
  return async () => { clearInterval(timer); await current }
}
