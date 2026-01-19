import express from 'express'
import { createInvoiceLink, SHOP_PRODUCTS } from '../services/telegram.js'
import { query } from '../db/index.js'

const router = express.Router()

/**
 * GET /api/payments/products
 * Список товаров для покупки
 */
router.get('/products', (req, res) => {
  const products = Object.entries(SHOP_PRODUCTS).map(([id, product]) => ({
    id,
    title: product.title,
    description: product.description,
    price: product.amount / 100, // В рублях
    currency: 'RUB',
  }))
  
  res.json({ products })
})

/**
 * POST /api/payments/create-invoice
 * Создать счёт для оплаты
 */
router.post('/create-invoice', async (req, res) => {
  try {
    const { productId } = req.body
    const userId = req.user?.userId

    if (!productId || !SHOP_PRODUCTS[productId]) {
      return res.status(400).json({ error: 'Invalid product' })
    }

    const product = SHOP_PRODUCTS[productId]
    
    const payload = JSON.stringify({
      productId,
      userId,
      timestamp: Date.now(),
    })

    const invoiceLink = await createInvoiceLink(
      product.title,
      product.description,
      payload,
      [{ label: product.title, amount: product.amount }]
    )

    if (!invoiceLink) {
      return res.status(500).json({ error: 'Failed to create invoice' })
    }

    res.json({ invoiceLink })
  } catch (error) {
    console.error('Create invoice error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * POST /api/payments/webhook
 * Webhook для обработки платежей от Telegram
 */
router.post('/webhook', async (req, res) => {
  try {
    const update = req.body

    // Обработка pre_checkout_query
    if (update.pre_checkout_query) {
      const { answerPreCheckoutQuery } = await import('../services/telegram.js')
      await answerPreCheckoutQuery(update.pre_checkout_query.id, true)
      return res.json({ ok: true })
    }

    // Обработка successful_payment
    if (update.message?.successful_payment) {
      const payment = update.message.successful_payment
      const payload = JSON.parse(payment.invoice_payload)
      
      await processSuccessfulPayment(payload, payment)
      return res.json({ ok: true })
    }

    res.json({ ok: true })
  } catch (error) {
    console.error('Payment webhook error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * Обрабатывает успешный платёж
 */
async function processSuccessfulPayment(payload, payment) {
  const { productId, userId } = payload
  const product = SHOP_PRODUCTS[productId]

  if (!product || !userId) return

  // Записываем транзакцию
  await query(
    `INSERT INTO transactions (user_id, type, amount, currency, description, reference_id)
     VALUES ($1, 'purchase', $2, 'RUB', $3, $4)`,
    [userId, payment.total_amount / 100, product.title, payment.telegram_payment_charge_id]
  )

  // Начисляем товары
  if (product.gems) {
    await query(
      'UPDATE users SET gems = gems + $2 WHERE id = $1',
      [userId, product.gems]
    )
  }

  if (product.gold) {
    await query(
      'UPDATE users SET gold = gold + $2 WHERE id = $1',
      [userId, product.gold]
    )
  }

  if (product.battlePassPremium) {
    await query(
      `UPDATE user_battle_pass SET is_premium = true 
       WHERE user_id = $1`,
      [userId]
    )
  }

  if (product.skin) {
    await query(
      `INSERT INTO user_skins (user_id, skin_id)
       SELECT $1, id FROM skins WHERE name = $2
       ON CONFLICT DO NOTHING`,
      [userId, product.skin]
    )
  }

  // Создаём уведомление
  await query(
    `INSERT INTO notifications (user_id, type, title, message)
     VALUES ($1, 'purchase', 'Покупка успешна!', $2)`,
    [userId, `Вы получили: ${product.title}`]
  )
}

export default router
