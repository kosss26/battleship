/**
 * Product analytics for the admin panel, computed from our own tables
 * (no third-party trackers): activity, retention cohorts, funnel, revenue, ads, engagement.
 */
import { query } from '../db.js'
import { STAR_PRODUCTS } from '../../../shared/catalog.js'

const seen = new Set()
let seenDay = ''

/** Records that the player was active today (deduplicated in memory) */
export function trackActivity(userId) {
  const day = new Date().toISOString().slice(0, 10)
  if (day !== seenDay) {
    seen.clear()
    seenDay = day
  }
  const key = `${userId}`
  if (seen.has(key)) return
  seen.add(key)
  query('INSERT INTO user_activity (user_id, day) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, day]).catch(() => seen.delete(key))
}

const RET_DAYS = [1, 3, 7, 14, 30]
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : null)

export async function analytics(days = 30) {
  const n = [7, 30, 90].includes(days) ? days : 30
  const since = `current_date - ${n - 1}`

  const [daily, cohorts, funnel, products, placements, modes, totals, mau] = await Promise.all([
    query(`
      SELECT to_char(d, 'YYYY-MM-DD') AS day,
        (SELECT count(*)::int FROM user_activity a WHERE a.day = d) AS dau,
        (SELECT count(*)::int FROM users u WHERE u.created_at::date = d) AS new_users,
        (SELECT count(*)::int FROM games g WHERE g.ended_at::date = d) AS games,
        (SELECT coalesce(sum(stars), 0)::int FROM payments p WHERE p.status = 'paid' AND p.created_at::date = d) AS stars,
        (SELECT count(*)::int FROM ad_views v WHERE v.created_at::date = d) AS ads
      FROM generate_series(${since}, current_date, interval '1 day') AS d ORDER BY d`),
    // Daily registration cohorts with day-N return rates
    query(`
      WITH c AS (
        SELECT id, created_at::date AS d0 FROM users WHERE created_at::date >= current_date - 44 AND NOT (data ? 'deletedAt')
      )
      SELECT to_char(c.d0, 'YYYY-MM-DD') AS day, count(*)::int AS size,
        ${RET_DAYS.map((k) => `count(*) FILTER (WHERE EXISTS (SELECT 1 FROM user_activity a WHERE a.user_id = c.id AND a.day = c.d0 + ${k}))::int AS d${k}`).join(',\n        ')}
      FROM c GROUP BY c.d0 ORDER BY c.d0 DESC`),
    query(`
      SELECT count(*)::int AS registered,
        count(*) FILTER (WHERE (data->>'onboarded')::boolean OR games > 0)::int AS onboarded,
        count(*) FILTER (WHERE games >= 1)::int AS played1,
        count(*) FILTER (WHERE games >= 5)::int AS played5,
        count(*) FILTER (WHERE EXISTS (SELECT 1 FROM user_activity a WHERE a.user_id = u.id AND a.day > u.created_at::date))::int AS returned,
        count(*) FILTER (WHERE EXISTS (SELECT 1 FROM ad_views v WHERE v.user_id = u.id))::int AS watched_ad,
        count(*) FILTER (WHERE EXISTS (SELECT 1 FROM payments p WHERE p.user_id = u.id AND p.status = 'paid'))::int AS paid
      FROM users u WHERE u.created_at::date >= ${since}`),
    query(`SELECT product_id, count(*)::int AS n, sum(stars)::int AS stars FROM payments
            WHERE status = 'paid' AND created_at::date >= ${since} GROUP BY product_id ORDER BY stars DESC`),
    query(`SELECT placement, count(*)::int AS n FROM ad_views WHERE created_at::date >= ${since} GROUP BY placement ORDER BY n DESC`),
    query(`SELECT mode, count(*)::int AS n FROM games WHERE ended_at::date >= ${since} GROUP BY mode ORDER BY n DESC`),
    query(`
      SELECT
        (SELECT count(DISTINCT user_id)::int FROM user_activity WHERE day >= ${since}) AS active,
        (SELECT count(DISTINCT user_id)::int FROM payments WHERE status = 'paid' AND created_at::date >= ${since}) AS payers,
        (SELECT coalesce(sum(stars), 0)::int FROM payments WHERE status = 'paid' AND created_at::date >= ${since}) AS stars,
        (SELECT count(*)::int FROM ad_views WHERE created_at::date >= ${since}) AS ads,
        (SELECT count(*)::int FROM games WHERE ended_at::date >= ${since}) AS games,
        (SELECT count(*)::int FROM users WHERE created_at::date >= ${since}) AS new_users,
        (SELECT count(*)::int FROM users WHERE created_at::date >= ${since} AND referred_by IS NOT NULL) AS referred`),
    query(`SELECT count(DISTINCT user_id)::int AS mau FROM user_activity WHERE day >= current_date - 29`),
  ])

  // Average retention over cohorts old enough to have that day
  const today = new Date(new Date().toISOString().slice(0, 10))
  const retention = Object.fromEntries(RET_DAYS.map((k) => {
    let size = 0
    let back = 0
    for (const c of cohorts.rows) {
      if ((today - new Date(c.day)) / 86400000 < k) continue
      size += c.size
      back += c[`d${k}`]
    }
    return [`d${k}`, pct(back, size)]
  }))

  const t = totals.rows[0]
  const days_ = daily.rows
  const avgDau = days_.length ? Math.round(days_.reduce((a, r) => a + r.dau, 0) / days_.length) : 0
  const productTitle = (id) => STAR_PRODUCTS.find((p) => p.id === id)?.title?.ru || id

  return {
    days: n,
    daily: days_,
    kpi: {
      avgDau,
      mau: mau.rows[0].mau,
      stickiness: pct(avgDau, mau.rows[0].mau),
      newUsers: t.new_users,
      referredShare: pct(t.referred, t.new_users),
      active: t.active,
      games: t.games,
      gamesPerActive: t.active ? Math.round((t.games / t.active) * 10) / 10 : 0,
      stars: t.stars,
      payers: t.payers,
      payerConversion: pct(t.payers, t.active),
      arpu: t.active ? Math.round((t.stars / t.active) * 10) / 10 : 0,
      arppu: t.payers ? Math.round(t.stars / t.payers) : 0,
      ads: t.ads,
      adsPerActive: t.active ? Math.round((t.ads / t.active) * 10) / 10 : 0,
    },
    retention,
    cohorts: cohorts.rows.slice(0, 14).map((c) => ({
      day: c.day,
      size: c.size,
      ...Object.fromEntries(RET_DAYS.map((k) => {
        const mature = (today - new Date(c.day)) / 86400000 >= k
        return [`d${k}`, mature ? pct(c[`d${k}`], c.size) : null]
      })),
    })),
    funnel: funnel.rows[0],
    products: products.rows.map((r) => ({ id: r.product_id, title: productTitle(r.product_id), n: r.n, stars: r.stars })),
    placements: placements.rows,
    modes: modes.rows,
  }
}
