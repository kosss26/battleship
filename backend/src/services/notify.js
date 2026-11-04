/**
 * Telegram bot notifications.
 *  - event notifications (friend request, duel invite, referral joined) are sent right away
 *  - reminders (daily reward, streak at risk, comeback) come from a scheduler,
 *    at most one automated reminder per user per ~day
 * Users can switch notifications off in settings; users who blocked the bot are skipped.
 */
import { query } from '../db.js'
import { config } from '../config.js'
import { botApi } from '../telegram.js'
import { DAILY_REWARDS } from '../../../shared/catalog.js'

const T = {
  ru: {
    play: '⚓ Играть',
    accept: '⚔️ Принять бой',
    daily_ready: (v) => `🎁 ${v.name}, награда за вход уже ждёт! Сегодня: ${v.reward}.`,
    streak_risk: (v) => `🔥 Ваша серия входов — ${v.streak} дн. — сгорит в полночь (UTC). Загляните, чтобы забрать награду!`,
    comeback3: (v) => `⚓ ${v.name}, флот ждёт командира! Новые задания дня уже обновились.`,
    comeback7: (v) => `🌊 Давно не виделись, ${v.name}! В море новые соперники — покажите, кто здесь адмирал.`,
    friend_request: (v) => `👋 ${v.from} хочет добавить вас в друзья в Морском бое.`,
    friend_accepted: (v) => `🤝 ${v.from} теперь у вас в друзьях. Вызовите на дуэль!`,
    duel_invite: (v) => `⚔️ ${v.from} вызывает вас на бой!\nКод дуэли: <b>${v.code}</b>`,
    referral_joined: (v) => `🎉 ${v.from} сыграл(а) первый бой по вашей ссылке. Награда: +500 🪙 и +${v.gems} 💎!`,
  },
  en: {
    play: '⚓ Play',
    accept: '⚔️ Accept the duel',
    daily_ready: (v) => `🎁 ${v.name}, your login reward is waiting! Today: ${v.reward}.`,
    streak_risk: (v) => `🔥 Your ${v.streak}-day login streak ends at midnight (UTC). Drop by to claim your reward!`,
    comeback3: (v) => `⚓ ${v.name}, the fleet awaits its commander! Today's quests are ready.`,
    comeback7: (v) => `🌊 Long time no see, ${v.name}! New rivals are at sea — show them who's admiral.`,
    friend_request: (v) => `👋 ${v.from} wants to be your friend in Battleship.`,
    friend_accepted: (v) => `🤝 ${v.from} is now your friend. Challenge them to a duel!`,
    duel_invite: (v) => `⚔️ ${v.from} challenges you to a battle!\nDuel code: <b>${v.code}</b>`,
    referral_joined: (v) => `🎉 ${v.from} played their first battle via your link. Reward: +500 🪙 and +${v.gems} 💎!`,
  },
}

const AUTOMATED = new Set(['daily_ready', 'streak_risk', 'comeback3', 'comeback7'])
const REMINDER_GAP_MS = 20 * 3600_000

/* ───────── outgoing queue (≈25 msg/s, Telegram's global limit is 30) ───────── */

let chain = Promise.resolve()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function enqueue(fn) {
  const p = chain.then(fn).catch((e) => e)
  chain = p.then(() => sleep(40))
  return p
}

async function setNotifyState(userId, patch) {
  await query(
    `UPDATE users SET data = jsonb_set(data, '{notifyState}', COALESCE(data->'notifyState', '{}'::jsonb) || $2::jsonb) WHERE id = $1`,
    [userId, JSON.stringify(patch)],
  )
}

/** Testing hook: lets tests capture messages without a bot token */
export const sent = []

/**
 * Sends one notification. `user` must contain id, tg_id, language and data.
 * Returns true if the message was delivered.
 */
export async function notify(user, kind, vars = {}, { startParam = '' } = {}) {
  if (!user?.tg_id) return false
  const d = user.data || {}
  if (d.settings?.notify === false || d.notifyState?.blocked) return false
  const lang = user.language === 'en' ? 'en' : 'ru'
  const text = T[lang][kind]?.({ name: user.first_name || 'Captain', ...vars })
  if (!text) return false

  const url = new URL(config.webappUrl)
  if (startParam) url.searchParams.set('startapp', startParam)
  const button = kind === 'duel_invite' ? T[lang].accept : T[lang].play
  const payload = {
    chat_id: Number(user.tg_id),
    text,
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: [[{ text: button, web_app: { url: url.toString() } }]] },
  }

  if (!config.botToken) {
    sent.push({ userId: Number(user.id), kind, text })
    if (AUTOMATED.has(kind)) await setNotifyState(user.id, { lastAuto: Date.now(), [kind]: Date.now() })
    return true
  }
  const res = await enqueue(() => botApi('sendMessage', payload))
  if (res instanceof Error) {
    const code = res.telegram?.error_code
    // 403: the user blocked the bot or never opened it — stop messaging them
    if (code === 403) await setNotifyState(user.id, { blocked: true })
    else if (res.telegram?.parameters?.retry_after) await sleep(res.telegram.parameters.retry_after * 1000)
    return false
  }
  if (AUTOMATED.has(kind)) await setNotifyState(user.id, { lastAuto: Date.now(), [kind]: Date.now() })
  return true
}

export async function notifyById(userId, kind, vars, opts) {
  const { rows } = await query('SELECT id, tg_id, first_name, language, data FROM users WHERE id = $1 AND NOT banned', [userId])
  return rows[0] ? notify(rows[0], kind, vars, opts) : false
}

/** Re-enables messages after the user opened the app again (they may have unblocked the bot) */
export async function clearBlocked(userId) {
  await query(`UPDATE users SET data = data #- '{notifyState,blocked}' WHERE id = $1 AND data->'notifyState' ? 'blocked'`, [userId])
}

/* ───────── reminders ───────── */

const day = (d) => d.toISOString().slice(0, 10)

function rewardText(r, lang) {
  const parts = []
  if (r.gold) parts.push(`${r.gold} 🪙`)
  if (r.gems) parts.push(`${r.gems} 💎`)
  if (r.boosters) parts.push(lang === 'ru' ? 'бустеры' : 'boosters')
  return parts.join(' + ')
}

/** Decides which reminder (if any) a user should get right now */
export function pickReminder(u, now = new Date(), isOnline = () => false) {
  const d = u.data || {}
  const st = d.notifyState || {}
  if (d.settings?.notify === false || st.blocked || isOnline(Number(u.id))) return null
  if (st.lastAuto && now - st.lastAuto < REMINDER_GAP_MS) return null
  const hour = now.getUTCHours()
  if (hour < 6 || hour > 19) return null // roughly daytime for Europe/CIS
  const today = day(now)
  const yesterday = day(new Date(now - 86400_000))
  const idle = now - new Date(u.last_seen)
  const daily = d.daily || {}

  if (daily.last === yesterday && daily.streak >= 2 && hour >= 15) {
    return { kind: 'streak_risk', vars: { streak: daily.streak } }
  }
  if (idle >= 7 * 86400_000 && idle < 8 * 86400_000 && !(st.comeback7 && now - st.comeback7 < 6 * 86400_000)) {
    return { kind: 'comeback7', vars: {} }
  }
  if (idle >= 3 * 86400_000 && idle < 4 * 86400_000 && !(st.comeback3 && now - st.comeback3 < 2 * 86400_000)) {
    return { kind: 'comeback3', vars: {} }
  }
  if (daily.last !== today && idle >= 20 * 3600_000 && idle < 3 * 86400_000) {
    const streak = daily.last === yesterday ? daily.streak + 1 : 1
    const reward = DAILY_REWARDS[(streak - 1) % DAILY_REWARDS.length]
    return { kind: 'daily_ready', vars: { reward: rewardText(reward, u.language === 'en' ? 'en' : 'ru') } }
  }
  return null
}

export async function runReminders(isOnline = () => false, now = new Date()) {
  const { rows } = await query(
    `SELECT id, tg_id, first_name, language, data, last_seen FROM users
      WHERE tg_id IS NOT NULL AND NOT banned
        AND last_seen < now() - interval '12 hours' AND last_seen > now() - interval '9 days'`,
  )
  let count = 0
  for (const u of rows) {
    const r = pickReminder(u, now, isOnline)
    if (r && (await notify(u, r.kind, r.vars))) count++
  }
  return count
}

export function startReminderScheduler(isOnline) {
  const tick = () => runReminders(isOnline).then((n) => n && console.log(`[notify] reminders sent: ${n}`)).catch((e) => console.error('[notify]', e.message))
  setTimeout(tick, 60_000).unref()
  setInterval(tick, 15 * 60_000).unref()
}
