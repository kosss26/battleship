/**
 * Monthly rating seasons.
 * When a month ends, every player with enough ranked games gets a result row with a reward
 * (claimed from the app), then all ratings are softly reset towards 1000.
 */
import { query, tx } from '../db.js'
import {
  seasonId, prevSeasonId, seasonInfo, seasonReward, rankFor, SEASON_MIN_GAMES,
} from '../../../shared/catalog.js'
import { mutateUser, grant, newSummary, checkAchievements, GameError } from './users.js'

const LOCK_KEY = 815_2026 // pg advisory lock id for season closing

async function getMeta(client, key) {
  const { rows } = await client.query('SELECT value FROM meta WHERE key = $1', [key])
  return rows[0]?.value ?? null
}

async function setMeta(client, key, value) {
  await client.query('INSERT INTO meta (key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value = $2', [key, value])
}

/** Ranked games/wins per player within a season */
async function seasonStandings(client, season) {
  const { startsAt, endsAt } = seasonInfo(season)
  const { rows } = await client.query(
    `WITH g AS (
        SELECT p1 AS uid, (winner = p1) AS won FROM games WHERE mode = 'ranked' AND ended_at >= $1 AND ended_at < $2 AND p1 IS NOT NULL
        UNION ALL
        SELECT p2 AS uid, (winner = p2) AS won FROM games WHERE mode = 'ranked' AND ended_at >= $1 AND ended_at < $2 AND p2 IS NOT NULL
      )
      SELECT u.id, u.rating, count(*)::int AS games, count(*) FILTER (WHERE g.won)::int AS wins
        FROM g JOIN users u ON u.id = g.uid
       WHERE NOT u.banned
       GROUP BY u.id, u.rating
      HAVING count(*) >= $3
       ORDER BY u.rating DESC, wins DESC, u.id`,
    [startsAt, endsAt, SEASON_MIN_GAMES],
  )
  return rows
}

/**
 * Closes `season` if it has not been closed yet. Safe to call repeatedly and from
 * several instances (advisory lock + meta marker). Returns number of rewarded players or null.
 */
export async function closeSeason(season) {
  return tx(async (c) => {
    const { rows: lock } = await c.query('SELECT pg_try_advisory_xact_lock($1) AS ok', [LOCK_KEY])
    if (!lock[0].ok) return null
    const last = await getMeta(c, 'last_closed_season')
    if (last && last >= season) return null

    const standings = await seasonStandings(c, season)
    let place = 0
    for (const r of standings) {
      place++
      const rank = rankFor(r.rating)
      await c.query(
        `INSERT INTO season_results (season, user_id, rating, rank, place, games, wins, reward)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING`,
        [season, r.id, r.rating, rank.id, place, r.games, r.wins, seasonReward(r.rating, place)],
      )
    }
    // Soft reset for everyone who has played
    // Same formula as seasonResetRating() in the shared catalogue
    const { rowCount } = await c.query('UPDATE users SET rating = ROUND(1000 + (rating - 1000) / 2.0) WHERE rating <> 1000')
    const users = { length: rowCount }
    await setMeta(c, 'last_closed_season', season)
    console.log(`[season] closed ${season}: ${standings.length} ranked players, ${users.length} ratings reset`)
    return standings.length
  })
}

/** Closes the previous season when a new month has started */
export async function checkSeasonRollover(now = new Date()) {
  const current = seasonId(now)
  const prev = prevSeasonId(current)
  // First run on a fresh deployment: start counting from the current season
  const last = (await query("SELECT value FROM meta WHERE key = 'last_closed_season'")).rows[0]?.value
  if (!last) {
    await query("INSERT INTO meta (key, value) VALUES ('last_closed_season', $1) ON CONFLICT DO NOTHING", [prev])
    return null
  }
  if (last < prev) return closeSeason(prev)
  return null
}

export function startSeasonScheduler() {
  const tick = () => checkSeasonRollover().catch((e) => console.error('[season]', e.message))
  tick()
  setInterval(tick, 10 * 60_000).unref()
}

/* ───────── player-facing ───────── */

export async function unclaimedResult(userId) {
  const { rows } = await query(
    'SELECT * FROM season_results WHERE user_id = $1 AND NOT claimed ORDER BY season DESC LIMIT 1',
    [userId],
  )
  return rows[0] ? resultView(rows[0]) : null
}

export async function seasonHistory(userId) {
  const { rows } = await query('SELECT * FROM season_results WHERE user_id = $1 ORDER BY season DESC LIMIT 24', [userId])
  return rows.map(resultView)
}

const resultView = (r) => ({
  season: r.season,
  number: seasonInfo(r.season).number,
  rating: r.rating,
  rank: r.rank,
  place: r.place,
  games: r.games,
  wins: r.wins,
  reward: r.reward,
  claimed: r.claimed,
})

export async function claimSeason(userId, season) {
  return tx(async (c) => {
    const { rows } = await c.query(
      'UPDATE season_results SET claimed = TRUE WHERE user_id = $1 AND season = $2 AND NOT claimed RETURNING reward',
      [userId, season],
    )
    if (!rows[0]) throw new GameError('already_claimed')
    const { user, result } = await mutateUser(userId, (u) => {
      const s = grant(u, rows[0].reward, newSummary())
      checkAchievements(u, s)
      return s
    }, c)
    return { user, summary: result }
  })
}

/** My progress in the current season (for the leaderboard header) */
export async function currentSeasonProgress(userId) {
  const { startsAt, endsAt } = seasonInfo()
  const { rows } = await query(
    `SELECT count(*)::int AS games, count(*) FILTER (WHERE winner = $1)::int AS wins
       FROM games WHERE mode = 'ranked' AND ended_at >= $2 AND ended_at < $3 AND (p1 = $1 OR p2 = $1)`,
    [userId, startsAt, endsAt],
  )
  return rows[0]
}
