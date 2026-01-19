import crypto from 'crypto'

/**
 * Сервис для работы с Telegram API
 * Согласно ТЗ: верификация данных, платежи, уведомления
 */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const PAYMENT_PROVIDER_TOKEN = process.env.TELEGRAM_PAYMENT_PROVIDER_TOKEN

/**
 * Верифицирует initData от Telegram WebApp
 */
export function verifyInitData(initData) {
  if (!BOT_TOKEN) {
    console.warn('TELEGRAM_BOT_TOKEN not set')
    return null
  }

  try {
    const params = new URLSearchParams(initData)
    const hash = params.get('hash')
    params.delete('hash')

    // Сортируем и формируем строку
    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n')

    // HMAC с секретом
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest()
    const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

    if (computedHash !== hash) {
      return null
    }

    const userStr = params.get('user')
    return userStr ? JSON.parse(decodeURIComponent(userStr)) : null
  } catch (error) {
    console.error('Verify initData error:', error)
    return null
  }
}

/**
 * Создаёт invoice для Telegram Payments
 */
export async function createInvoiceLink(title, description, payload, prices, currency = 'RUB') {
  if (!BOT_TOKEN || !PAYMENT_PROVIDER_TOKEN) {
    console.warn('Telegram payment tokens not configured')
    return null
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/createInvoiceLink`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        description,
        payload,
        provider_token: PAYMENT_PROVIDER_TOKEN,
        currency,
        prices, // [{ label: 'Item', amount: 10000 }] (в копейках)
      }),
    })

    const data = await response.json()
    
    if (data.ok) {
      return data.result
    }
    
    console.error('Create invoice error:', data)
    return null
  } catch (error) {
    console.error('Create invoice error:', error)
    return null
  }
}

/**
 * Отправляет сообщение пользователю
 */
export async function sendMessage(chatId, text, options = {}) {
  if (!BOT_TOKEN) return null

  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        ...options,
      }),
    })

    return await response.json()
  } catch (error) {
    console.error('Send message error:', error)
    return null
  }
}

/**
 * Подтверждает успешную pre_checkout_query
 */
export async function answerPreCheckoutQuery(preCheckoutQueryId, ok = true, errorMessage = null) {
  if (!BOT_TOKEN) return null

  try {
    const body = { pre_checkout_query_id: preCheckoutQueryId, ok }
    if (!ok && errorMessage) {
      body.error_message = errorMessage
    }

    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerPreCheckoutQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    return await response.json()
  } catch (error) {
    console.error('Answer pre-checkout error:', error)
    return null
  }
}

/**
 * Товары для покупки
 */
export const SHOP_PRODUCTS = {
  gems_100: {
    title: '100 Гемов',
    description: 'Пакет из 100 гемов для Battleship Online',
    amount: 9900, // 99 RUB в копейках
    gems: 100,
  },
  gems_500: {
    title: '500 Гемов + 50 бонус',
    description: 'Пакет из 550 гемов для Battleship Online',
    amount: 44900,
    gems: 550,
  },
  gems_1000: {
    title: '1000 Гемов + 200 бонус',
    description: 'Пакет из 1200 гемов для Battleship Online',
    amount: 79900,
    gems: 1200,
  },
  starter_pack: {
    title: 'Стартовый набор',
    description: '500 Gold + 50 Gems + Эксклюзивный скин',
    amount: 14900,
    gold: 500,
    gems: 50,
    skin: 'starter_exclusive',
  },
  battle_pass_premium: {
    title: 'Battle Pass Premium',
    description: 'Премиум Battle Pass с эксклюзивными наградами',
    amount: 29900,
    battlePassPremium: true,
  },
}

export default {
  verifyInitData,
  createInvoiceLink,
  sendMessage,
  answerPreCheckoutQuery,
  SHOP_PRODUCTS,
}
