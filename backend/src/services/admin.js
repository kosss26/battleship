import { query } from '../db.js'
import { config } from '../config.js'
import { botApi } from '../telegram.js'
import { BOOSTERS, findCosmetic, seasonId, DEFAULT_OWNED, DEFAULT_EQUIPPED } from '../../../shared/catalog.js'
import { getUser, mutateUser, selfView, displayName, GameError, isAdmin } from './users.js'
import { refundPayment } from './shop.js'
import { stats as liveStats, notifyProfile, kickUser } from '../game/manager.js'

export async function requireAdmin(userId) {
  const u = await getUser(userId)
  if (!isAdmin(u)) throw new GameError('forbidden', 403)
  return u
}

export async function logAction(adminId, action, targetId, details = {}) {
  await query('INSERT INTO admin_log (admin_id, action, target_id, details) VALUES ($1,$2,$3,$4)', [adminId, action, targetId || null, details])
}

/* ───────── dashboard ───────── */

export async function dashboard() {
  const [{ rows: u }, { rows: g }, { rows: p }, { rows: daily }] = await Promise.all([
    query(`SELECT count(*)::int AS total,
        count(*) FILTER (WHERE created_at > now() - interval '1 day')::int AS new_day,
        count(*) FILTER (WHERE created_at > now() - interval '7 days')::int AS new_week,
        count(*) FILTER (WHERE last_seen > now() - interval '1 day')::int AS dau,
        count(*) FILTER (WHERE last_seen > now() - interval '7 days')::int AS wau,
        count(*) FILTER (WHERE last_seen > now() - interval '30 days')::int AS mau,
        count(*) FILTER (WHERE banned)::int AS banned,
        count(*) FILTER (WHERE referred_by IS NOT NULL)::int AS referred
      FROM users`),
    query(`SELECT mode, count(*)::int AS n FROM games WHERE ended_at > now() - interval '1 day' GROUP BY mode`),
    query(`SELECT
        coalesce(sum(stars) FILTER (WHERE status='paid'),0)::int AS stars_total,
        coalesce(sum(stars) FILTER (WHERE status='paid' AND created_at > now() - interval '1 day'),0)::int AS stars_day,
        coalesce(sum(stars) FILTER (WHERE status='paid' AND created_at > now() - interval '7 days'),0)::int AS stars_week,
        count(*) FILTER (WHERE status='paid')::int AS payments,
        count(*) FILTER (WHERE status='refunded')::int AS refunds,
        count(DISTINCT user_id) FILTER (WHERE status='paid')::int AS payers
      FROM payments`),
    query(`SELECT to_char(d, 'MM-DD') AS day,
        (SELECT count(*)::int FROM users WHERE created_at::date = d) AS new_users,
        (SELECT count(*)::int FROM games WHERE ended_at::date = d) AS games,
        (SELECT coalesce(sum(stars),0)::int FROM payments WHERE status='paid' AND created_at::date = d) AS stars
      FROM generate_series(current_date - 13, current_date, interval '1 day') AS d ORDER BY d`),
  ])
  const users = u[0]
  const pay = p[0]
  const { rows: adRows } = await query(`SELECT
      count(*) FILTER (WHERE created_at > now() - interval '1 day')::int AS day,
      count(*) FILTER (WHERE created_at > now() - interval '7 days')::int AS week,
      count(DISTINCT user_id) FILTER (WHERE created_at > now() - interval '1 day')::int AS viewers_day
    FROM ad_views`)
  const { rows: suspicious } = await query(
    `SELECT LEAST(p1, p2) AS a, GREATEST(p1, p2) AS b, count(*)::int AS games,
            count(*) FILTER (WHERE reason <> 'victory' AND shots < 12)::int AS early,
            min(ua.first_name) AS a_name, min(ub.first_name) AS b_name
       FROM games g
       JOIN users ua ON ua.id = LEAST(p1, p2) JOIN users ub ON ub.id = GREATEST(p1, p2)
      WHERE mode = 'ranked' AND ended_at > now() - interval '24 hours' AND p1 IS NOT NULL AND p2 IS NOT NULL
      GROUP BY 1, 2 HAVING count(*) >= 3 OR count(*) FILTER (WHERE reason <> 'victory' AND shots < 12) >= 2
      ORDER BY games DESC LIMIT 20`,
  )
  return {
    users,
    gamesToday: Object.fromEntries(g.map((r) => [r.mode, r.n])),
    payments: { ...pay, conversion: users.total ? +((pay.payers / users.total) * 100).toFixed(2) : 0, arppu: pay.payers ? Math.round(pay.stars_total / pay.payers) : 0 },
    daily,
    ads: adRows[0],
    suspicious: suspicious.map((r) => ({ a: Number(r.a), b: Number(r.b), aName: r.a_name, bName: r.b_name, games: r.games, early: r.early })),
    live: liveStats(),
    season: seasonId(),
  }
}

/* ───────── players ───────── */

const userRow = (r) => ({
  id: Number(r.id),
  tgId: r.tg_id ? Number(r.tg_id) : null,
  name: [r.first_name, r.last_name].filter(Boolean).join(' '),
  username: r.username,
  photo: r.photo_url,
  level: r.level,
  rating: r.rating,
  gold: r.gold,
  gems: r.gems,
  games: r.games,
  banned: r.banned,
  lastSeen: r.last_seen,
  createdAt: r.created_at,
})

export async function searchUsers(q = '') {
  const term = String(q).trim().replace(/^@/, '')
  let rows
  if (!term) {
    ;({ rows } = await query('SELECT * FROM users ORDER BY last_seen DESC LIMIT 50'))
  } else if (/^\d+$/.test(term)) {
    ;({ rows } = await query('SELECT * FROM users WHERE id = $1 OR tg_id = $1 LIMIT 50', [term]))
  } else {
    ;({ rows } = await query(
      `SELECT * FROM users WHERE username ILIKE $1 OR first_name ILIKE $1 OR last_name ILIKE $1 OR ref_code = upper($2)
        ORDER BY last_seen DESC LIMIT 50`,
      [`%${term}%`, term],
    ))
  }
  return rows.map(userRow)
}

export async function userDetail(id) {
  const u = await getUser(id)
  if (!u) throw new GameError('not_found', 404)
  const [{ rows: games }, { rows: payments }, { rows: log }, { rows: refs }] = await Promise.all([
    query(`SELECT id, mode, difficulty, reason, shots, duration_ms, ended_at, winner, p1_delta, p2_delta, p1
             FROM games WHERE p1 = $1 OR p2 = $1 ORDER BY ended_at DESC LIMIT 20`, [id]),
    query('SELECT * FROM payments WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50', [id]),
    query(`SELECT l.*, a.first_name AS admin_name FROM admin_log l JOIN users a ON a.id = l.admin_id
            WHERE l.target_id = $1 ORDER BY l.created_at DESC LIMIT 30`, [id]),
    query('SELECT count(*)::int AS n FROM users WHERE referred_by = $1', [id]),
  ])
  const referrer = u.referred_by ? await getUser(u.referred_by) : null
  return {
    profile: selfView(u),
    tgId: u.tg_id,
    banned: u.banned,
    banReason: u.ban_reason,
    createdAt: u.created_at,
    lastSeen: u.last_seen,
    referrer: referrer ? { id: referrer.id, name: displayName(referrer) } : null,
    referrals: refs[0].n,
    games: games.map((g) => ({
      id: g.id, mode: g.mode, difficulty: g.difficulty, reason: g.reason, shots: g.shots,
      durationMs: g.duration_ms, endedAt: g.ended_at, won: Number(g.winner) === id,
      ratingDelta: Number(g.p1) === id ? g.p1_delta : g.p2_delta,
    })),
    payments: payments.map(paymentRow),
    log: log.map(logRow),
  }
}

export async function setBan(admin, id, banned, reason = '') {
  const target = await getUser(id)
  if (!target) throw new GameError('not_found', 404)
  if (isAdmin(target)) throw new GameError('cannot_ban_admin')
  await query('UPDATE users SET banned = $2, ban_reason = $3 WHERE id = $1', [id, !!banned, banned ? String(reason).slice(0, 300) : null])
  if (banned) kickUser(id)
  await logAction(admin.id, banned ? 'ban' : 'unban', id, { reason })
}

/**
 * Manual correction. changes: { gold, gems (deltas, may be negative), boosters: {id: delta},
 * grantCosmetics: [], removeCosmetics: [], premiumPass: true|false, rating: absolute }
 */
export async function adjustUser(admin, id, changes = {}, reason = '') {
  if (!String(reason).trim()) throw new GameError('reason_required')
  const applied = {}
  const { user } = await mutateUser(id, (u) => {
    for (const key of ['gold', 'gems']) {
      const d = Math.trunc(Number(changes[key]) || 0)
      if (!d) continue
      if (u[key] + d < 0) throw new GameError(`negative_${key}`)
      u[key] += d
      applied[key] = d
    }
    for (const [b, raw] of Object.entries(changes.boosters || {})) {
      const d = Math.trunc(Number(raw) || 0)
      if (!BOOSTERS[b] || !d) continue
      u.data.boosters[b] = Math.max(0, (u.data.boosters[b] || 0) + d)
      ;(applied.boosters ||= {})[b] = d
    }
    for (const c of changes.grantCosmetics || []) {
      if (!findCosmetic(c) || u.data.owned.includes(c)) continue
      u.data.owned.push(c)
      ;(applied.grantCosmetics ||= []).push(c)
    }
    for (const c of changes.removeCosmetics || []) {
      const found = findCosmetic(c)
      if (!found || !u.data.owned.includes(c) || DEFAULT_OWNED.includes(c)) continue
      u.data.owned = u.data.owned.filter((x) => x !== c)
      if (u.data.equipped[found.slot] === c) u.data.equipped[found.slot] = DEFAULT_EQUIPPED[found.slot]
      ;(applied.removeCosmetics ||= []).push(c)
    }
    if (typeof changes.premiumPass === 'boolean' && changes.premiumPass !== u.data.pass.premium) {
      u.data.pass.premium = changes.premiumPass
      applied.premiumPass = changes.premiumPass
    }
    if (changes.rating != null && changes.rating !== '') {
      const r = Math.trunc(Number(changes.rating))
      if (!Number.isFinite(r) || r < 0 || r > 5000) throw new GameError('bad_rating')
      if (r !== u.rating) {
        applied.rating = { from: u.rating, to: r }
        u.rating = r
      }
    }
  }, null, { allowBanned: true, touch: false })
  if (!Object.keys(applied).length) throw new GameError('nothing_changed')
  await logAction(admin.id, 'adjust', id, { ...applied, reason })
  notifyProfile(id, selfView(user))
  return applied
}

/* ───────── payments ───────── */

const paymentRow = (r) => ({
  id: Number(r.id),
  userId: Number(r.user_id),
  userName: r.first_name ? [r.first_name, r.last_name].filter(Boolean).join(' ') : undefined,
  productId: r.product_id,
  stars: r.stars,
  chargeId: r.charge_id,
  status: r.status,
  createdAt: r.created_at,
  refundedAt: r.refunded_at,
  revoked: r.revoked,
})

export async function listPayments(status) {
  const params = []
  let where = ''
  if (['paid', 'refunded'].includes(status)) {
    params.push(status)
    where = 'WHERE p.status = $1'
  }
  const { rows } = await query(
    `SELECT p.*, u.first_name, u.last_name FROM payments p JOIN users u ON u.id = p.user_id ${where}
      ORDER BY p.created_at DESC LIMIT 100`,
    params,
  )
  return rows.map(paymentRow)
}

export async function refund(admin, paymentId, reason = '') {
  const { rows } = await query('SELECT p.*, u.tg_id FROM payments p JOIN users u ON u.id = p.user_id WHERE p.id = $1', [paymentId])
  const pay = rows[0]
  if (!pay) throw new GameError('not_found', 404)
  if (pay.status !== 'paid') throw new GameError('already_refunded')
  // Return the Stars first; only revoke goods if Telegram accepted the refund
  if (config.botToken) {
    try {
      await botApi('refundStarPayment', { user_id: Number(pay.tg_id), telegram_payment_charge_id: pay.charge_id })
    } catch (e) {
      const err = new GameError('telegram_refund_failed', 502)
      err.detail = e.message
      throw err
    }
  }
  const res = await refundPayment({ id: paymentId })
  if (!res) throw new GameError('already_refunded')
  await logAction(admin.id, 'refund', Number(pay.user_id), { paymentId: Number(paymentId), product: pay.product_id, stars: pay.stars, revoked: res.revoked, reason })
  notifyProfile(Number(pay.user_id), selfView(res.user))
  return res.revoked
}

/* ───────── log ───────── */

const logRow = (r) => ({
  id: Number(r.id),
  adminId: Number(r.admin_id),
  adminName: r.admin_name,
  action: r.action,
  targetId: r.target_id ? Number(r.target_id) : null,
  targetName: r.target_name,
  details: r.details,
  createdAt: r.created_at,
})

export async function adminLog() {
  const { rows } = await query(
    `SELECT l.*, a.first_name AS admin_name, t.first_name AS target_name FROM admin_log l
       JOIN users a ON a.id = l.admin_id LEFT JOIN users t ON t.id = l.target_id
      ORDER BY l.created_at DESC LIMIT 100`,
  )
  return rows.map(logRow)
}

/* ───────── broadcast ───────── */

const SEGMENTS = {
  all: 'TRUE',
  active: "last_seen > now() - interval '3 days'",
  inactive7: "last_seen < now() - interval '7 days'",
  payers: "EXISTS (SELECT 1 FROM payments p WHERE p.user_id = users.id AND p.status = 'paid')",
  nonpayers: "NOT EXISTS (SELECT 1 FROM payments p WHERE p.user_id = users.id AND p.status = 'paid')",
}

const jobs = new Map()
let jobSeq = 0

export async function broadcast(admin, { text, segment = 'all', button = true, dryRun = false }) {
  const body = String(text || '').trim()
  if (!SEGMENTS[segment]) throw new GameError('bad_segment')
  if (!dryRun && (body.length < 2 || body.length > 3500)) throw new GameError('bad_text')
  const { rows } = await query(`SELECT tg_id FROM users WHERE tg_id IS NOT NULL AND NOT banned AND ${SEGMENTS[segment]}`)
  if (dryRun) return { recipients: rows.length }
  if (!config.botToken) throw new GameError('bot_not_configured', 503)
  for (const j of jobs.values()) if (!j.done) throw new GameError('broadcast_running')

  const job = { id: ++jobSeq, segment, total: rows.length, sent: 0, failed: 0, done: false, startedAt: new Date().toISOString() }
  jobs.set(job.id, job)
  await logAction(admin.id, 'broadcast', null, { segment, recipients: rows.length, text: body.slice(0, 500) })
  const markup = button ? { inline_keyboard: [[{ text: '⚓ Играть / Play', web_app: { url: config.webappUrl } }]] } : undefined
  ;(async () => {
    for (const r of rows) {
      try {
        await botApi('sendMessage', { chat_id: Number(r.tg_id), text: body, parse_mode: 'HTML', reply_markup: markup })
        job.sent++
      } catch (e) {
        job.failed++
        const retry = e.telegram?.parameters?.retry_after
        if (retry) await new Promise((res) => setTimeout(res, retry * 1000))
      }
      await new Promise((res) => setTimeout(res, 40)) // ~25 msg/s, within Telegram limits
    }
    job.done = true
    job.finishedAt = new Date().toISOString()
  })()
  return job
}

export const broadcastJobs = () => [...jobs.values()].reverse().slice(0, 10)

