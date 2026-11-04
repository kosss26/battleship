import crypto from 'crypto'
import { config } from './config.js'

/**
 * Validates Telegram Mini App initData (HMAC-SHA256 per Telegram docs).
 * Returns { user, startParam, authDate } or null.
 */
export function verifyInitData(initData, botToken = config.botToken, maxAgeSec = 86400) {
  if (!initData || !botToken) return null
  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  if (!hash) return null
  params.delete('hash')
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')
  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest()
  const calc = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex')
  const a = Buffer.from(calc, 'hex')
  const b = Buffer.from(hash, 'hex')
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null

  const authDate = Number(params.get('auth_date') || 0)
  if (!authDate || Date.now() / 1000 - authDate > maxAgeSec) return null

  let user
  try {
    user = JSON.parse(params.get('user') || 'null')
  } catch {
    return null
  }
  if (!user?.id) return null
  return { user, startParam: params.get('start_param') || '', authDate }
}

/** Calls the Telegram Bot API */
export async function botApi(method, payload = {}) {
  if (!config.botToken) throw new Error('TELEGRAM_BOT_TOKEN is not configured')
  const res = await fetch(`https://api.telegram.org/bot${config.botToken}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const json = await res.json().catch(() => ({}))
  if (!json.ok) {
    const err = new Error(`Telegram ${method} failed: ${json.description || res.status}`)
    err.telegram = json
    throw err
  }
  return json.result
}

/** Direct Mini App link, e.g. https://t.me/bot/play?startapp=ref_ABC */
export function appLink(startParam = '') {
  if (!config.botUsername) {
    // No bot configured: point straight at the web app, keeping the start parameter
    if (!startParam) return config.webappUrl
    const url = new URL(config.webappUrl)
    url.searchParams.set('startapp', startParam)
    return url.toString()
  }
  const base = `https://t.me/${config.botUsername}/${config.appShortName}`
  return startParam ? `${base}?startapp=${encodeURIComponent(startParam)}` : base
}
