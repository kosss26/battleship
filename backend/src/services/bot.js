import { config } from '../config.js'
import { botApi, appLink } from '../telegram.js'
import { query } from '../db.js'
import { findStarProduct } from '../../../shared/catalog.js'
import { getUser, selfView } from './users.js'
import { validateStarPurchase, completeStarPayment, markRefunded } from './shop.js'
import { notifyProfile, stats as liveStats } from '../game/manager.js'
import { refund } from './admin.js'

const TEXT = {
  ru: {
    welcome: (name) => `⚓ <b>${name}, добро пожаловать на борт!</b>\n\nМорской бой нового поколения прямо в Telegram:\n• бои с ИИ четырёх уровней и кампания на 30 миссий\n• рейтинговые PvP-сражения в реальном времени\n• дуэли с друзьями по ссылке\n• боевой пропуск, задания и коллекция скинов\n\nЖми кнопку и выходи в море 👇`,
    play: '🚢 Играть',
    paid: (title) => `✅ Покупка «${title}» зачислена. Спасибо, капитан!`,
  },
  en: {
    welcome: (name) => `⚓ <b>Welcome aboard, ${name}!</b>\n\nNext-gen Battleship right inside Telegram:\n• 4 AI levels and a 30-mission campaign\n• real-time ranked PvP\n• duels with friends via link\n• battle pass, quests and a skin collection\n\nTap the button and set sail 👇`,
    play: '🚢 Play',
    paid: (title) => `✅ "${title}" has been delivered. Thank you, captain!`,
  },
}

const langOf = (from) => ((from?.language_code || '').startsWith('ru') ? 'ru' : 'en')

async function userIdByTg(tgId) {
  const { rows } = await query('SELECT id FROM users WHERE tg_id = $1', [tgId])
  return rows[0] ? Number(rows[0].id) : null
}

function playMarkup(lang, startParam = '') {
  const url = new URL(config.webappUrl)
  if (startParam) url.searchParams.set('tgWebAppStartParam', startParam)
  return { inline_keyboard: [[{ text: TEXT[lang].play, web_app: { url: url.toString() } }]] }
}

export async function handleUpdate(update) {
  if (update.pre_checkout_query) return onPreCheckout(update.pre_checkout_query)
  const msg = update.message
  if (!msg) return
  if (msg.successful_payment) return onPaid(msg)
  if (msg.refunded_payment) return markRefunded(msg.refunded_payment.telegram_payment_charge_id)

  const text = msg.text || ''
  const lang = langOf(msg.from)
  if (text.startsWith('/start')) {
    const param = text.split(' ')[1] || ''
    await botApi('sendMessage', {
      chat_id: msg.chat.id,
      text: TEXT[lang].welcome(msg.from.first_name || 'Captain'),
      parse_mode: 'HTML',
      reply_markup: playMarkup(lang, param),
    })
  } else if (text === '/paysupport') {
    await botApi('sendMessage', {
      chat_id: msg.chat.id,
      text: lang === 'ru'
        ? 'По вопросам оплаты напишите сюда описание проблемы — мы ответим в течение 24 часов.'
        : 'For payment issues, describe the problem here — we will reply within 24 hours.',
    })
  } else if (text === '/stats' && config.adminIds.includes(String(msg.from.id))) {
    const { rows } = await query(`SELECT count(*)::int AS users,
      count(*) FILTER (WHERE last_seen > now() - interval '1 day')::int AS dau,
      (SELECT coalesce(sum(stars),0)::int FROM payments WHERE status='paid') AS stars FROM users`)
    const live = liveStats()
    await botApi('sendMessage', { chat_id: msg.chat.id, text: `👥 ${rows[0].users} users, DAU ${rows[0].dau}\n⭐ ${rows[0].stars} stars\n🎮 rooms ${live.rooms}, queue ${live.queue}, sockets ${live.online}` })
  } else if (text.startsWith('/refund ') && config.adminIds.includes(String(msg.from.id))) {
    const [, , chargeId] = text.split(' ')
    const { rows } = await query('SELECT id FROM payments WHERE charge_id = $1', [chargeId])
    const adminId = await userIdByTg(msg.from.id)
    try {
      if (!rows[0] || !adminId) throw new Error('payment not found')
      const revoked = await refund({ id: adminId }, Number(rows[0].id), 'bot command')
      await botApi('sendMessage', { chat_id: msg.chat.id, text: `Refunded. Revoked: ${JSON.stringify(revoked)}` })
    } catch (e) {
      await botApi('sendMessage', { chat_id: msg.chat.id, text: `Refund failed: ${e.code || e.message}` })
    }
  } else if (msg.chat.type === 'private') {
    await botApi('sendMessage', { chat_id: msg.chat.id, text: '⚓', reply_markup: playMarkup(lang) })
  }
}

async function onPreCheckout(q) {
  let ok = false
  let error = 'Product unavailable'
  try {
    const payload = JSON.parse(q.invoice_payload)
    const userId = await userIdByTg(q.from.id)
    const user = userId && (await getUser(userId))
    const p = findStarProduct(payload.p)
    if (user && p && user.id === payload.u && q.currency === 'XTR' && q.total_amount === p.stars) {
      validateStarPurchase(user, p.id)
      ok = true
    }
  } catch (e) {
    error = e.code === 'already_owned' ? 'Already purchased' : error
  }
  await botApi('answerPreCheckoutQuery', ok
    ? { pre_checkout_query_id: q.id, ok: true }
    : { pre_checkout_query_id: q.id, ok: false, error_message: error })
}

async function onPaid(msg) {
  const sp = msg.successful_payment
  const payload = JSON.parse(sp.invoice_payload)
  const userId = await userIdByTg(msg.from.id)
  if (!userId || userId !== payload.u) {
    console.error('[payment] user mismatch', sp.telegram_payment_charge_id)
    return
  }
  const res = await completeStarPayment({
    userId,
    productId: payload.p,
    stars: sp.total_amount,
    chargeId: sp.telegram_payment_charge_id,
    payload,
  })
  if (!res) return
  notifyProfile(userId, selfView(res.user))
  const p = findStarProduct(payload.p)
  const lang = res.user.language === 'ru' ? 'ru' : 'en'
  await botApi('sendMessage', { chat_id: msg.chat.id, text: TEXT[lang].paid(p.title[lang]) }).catch(() => {})
}

export async function createStarInvoice(user, productId) {
  const p = validateStarPurchase(user, productId)
  const lang = user.language === 'ru' ? 'ru' : 'en'
  return botApi('createInvoiceLink', {
    title: p.title[lang],
    description: p.desc?.[lang] || `${p.gems} 💎`,
    payload: JSON.stringify({ u: user.id, p: p.id, t: Date.now() }),
    currency: 'XTR',
    prices: [{ label: p.title[lang], amount: p.stars }],
  })
}

/* ───────── webhook / polling setup ───────── */

export async function setupBot() {
  if (!config.botToken) {
    console.log('[bot] TELEGRAM_BOT_TOKEN not set — bot features disabled')
    return
  }
  try {
    await botApi('setMyCommands', { commands: [
      { command: 'start', description: 'Играть / Play' },
      { command: 'paysupport', description: 'Помощь с оплатой / Payment support' },
    ] })
    await botApi('setChatMenuButton', { menu_button: { type: 'web_app', text: '⚓ Play', web_app: { url: config.webappUrl } } })
  } catch (e) {
    console.error('[bot] setup', e.message)
  }

  if (config.botPolling) {
    await botApi('deleteWebhook', {}).catch(() => {})
    poll(0)
    console.log('[bot] long polling started')
  } else if (config.publicUrl) {
    await botApi('setWebhook', {
      url: `${config.publicUrl}/api/telegram/webhook`,
      secret_token: config.webhookSecret || undefined,
      allowed_updates: ['message', 'pre_checkout_query'],
    }).then(() => console.log('[bot] webhook set')).catch((e) => console.error('[bot] webhook', e.message))
  }
}

async function poll(offset) {
  try {
    const updates = await botApi('getUpdates', { offset, timeout: 25, allowed_updates: ['message', 'pre_checkout_query'] })
    for (const u of updates) {
      offset = u.update_id + 1
      await handleUpdate(u).catch((e) => console.error('[bot] update', e.message))
    }
  } catch (e) {
    console.error('[bot] poll', e.message)
    await new Promise((r) => setTimeout(r, 3000))
  }
  setImmediate(() => poll(offset))
}

export { appLink }
