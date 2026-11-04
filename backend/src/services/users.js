import crypto from 'crypto'
import { query, tx } from '../db.js'
import { config } from '../config.js'
import {
  ACHIEVEMENTS, QUESTS, questsForDay, levelFromXp, levelUpReward, rankFor, seasonId, seasonEnds,
  PASS_TIERS, PASS_XP_PER_TIER, DAILY_REWARDS, DEFAULT_EQUIPPED, DEFAULT_OWNED, findCosmetic,
  BOOSTERS, CAMPAIGN, passRewards, DUEL_REWARDS_PER_DAY,
} from '../../../shared/catalog.js'

export const today = (d = new Date()) => d.toISOString().slice(0, 10)
const dayDiff = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000)

export class GameError extends Error {
  constructor(code, status = 400) {
    super(code)
    this.code = code
    this.status = status
  }
}

/* ───────────── data defaults ───────────── */

function defaultData() {
  return {
    stats: {
      games: 0, wins: 0, losses: 0, shots: 0, hits: 0, sunk: 0, shipsLost: 0,
      streak: 0, bestStreak: 0, bestHitChain: 0, perfectWins: 0, fastWins: 0,
      easyWins: 0, mediumWins: 0, hardWins: 0, expertWins: 0,
      pvpGames: 0, pvpWins: 0, duels: 0, referrals: 0, bestDailyStreak: 0, fastestWin: null,
    },
    equipped: { ...DEFAULT_EQUIPPED },
    owned: [...DEFAULT_OWNED],
    boosters: { radar: 2, barrage: 1 },
    campaign: {},
    daily: { streak: 0, last: null },
    quests: { day: null, items: {} },
    pass: { season: null, xp: 0, premium: false, free: [], prem: [] },
    achievements: {},
    settings: { sound: true, haptics: true, music: true, notify: true },
    onboarded: false,
    purchases: {},
    duelRewards: { day: null, count: 0 },
    refRewarded: false,
  }
}

/** Fills missing keys so older rows keep working after content updates */
function normalizeData(data) {
  const d = defaultData()
  const out = { ...d, ...data }
  out.stats = { ...d.stats, ...(data?.stats || {}) }
  out.equipped = { ...d.equipped, ...(data?.equipped || {}) }
  out.settings = { ...d.settings, ...(data?.settings || {}) }
  out.boosters = { ...d.boosters, ...(data?.boosters || {}) }
  out.pass = { ...d.pass, ...(data?.pass || {}) }
  for (const id of DEFAULT_OWNED) if (!out.owned.includes(id)) out.owned.push(id)
  return out
}

const rowToUser = (row) => (row ? { ...row, id: Number(row.id), tg_id: row.tg_id && Number(row.tg_id), referred_by: row.referred_by && Number(row.referred_by), data: normalizeData(row.data) } : null)

/* ───────────── loading & saving ───────────── */

export async function getUser(id) {
  const { rows } = await query('SELECT * FROM users WHERE id = $1', [id])
  return rowToUser(rows[0])
}

export async function getUsers(ids) {
  if (!ids.length) return []
  const { rows } = await query('SELECT * FROM users WHERE id = ANY($1)', [ids])
  return rows.map(rowToUser)
}

/**
 * Locks the user row, runs `fn(user)` which mutates the object, then persists it.
 * Everything that changes balances goes through here, so it is atomic.
 */
export async function mutateUser(id, fn, client = null, { allowBanned = false, touch = true } = {}) {
  const run = async (c) => {
    const { rows } = await c.query('SELECT * FROM users WHERE id = $1 FOR UPDATE', [id])
    const user = rowToUser(rows[0])
    if (!user) throw new GameError('user_not_found', 404)
    if (user.banned && !allowBanned) throw new GameError('banned', 403)
    syncPeriodic(user)
    const result = await fn(user, c)
    const lvl = levelFromXp(user.xp)
    user.level = lvl.level
    user.peak_rating = Math.max(user.peak_rating, user.rating)
    await c.query(
      `UPDATE users SET gold=$2, gems=$3, xp=$4, level=$5, rating=$6, peak_rating=$7, games=$8, wins=$9,
        data=$10, language=$11${touch ? ', last_seen=now()' : ''} WHERE id=$1`,
      [id, user.gold, user.gems, user.xp, user.level, user.rating, user.peak_rating, user.data.stats.games,
        user.data.stats.wins, user.data, user.language],
    )
    return { user, result }
  }
  return client ? run(client) : tx(run)
}

const genRefCode = () => crypto.randomBytes(5).toString('base64url').replace(/[-_]/g, 'x').slice(0, 7).toUpperCase()

export async function upsertTelegramUser(tg, { refCode } = {}) {
  const existing = await query('SELECT * FROM users WHERE tg_id = $1', [tg.id])
  if (existing.rows[0]) {
    const { rows } = await query(
      `UPDATE users SET username=$2, first_name=$3, last_name=$4, photo_url=COALESCE($5, photo_url),
        tg_premium=$6, last_seen=now() WHERE tg_id=$1 RETURNING *`,
      [tg.id, tg.username || null, tg.first_name || 'Player', tg.last_name || null, tg.photo_url || null, !!tg.is_premium],
    )
    return { user: rowToUser(rows[0]), isNew: false }
  }

  let referrer = null
  if (refCode) {
    const r = await query('SELECT id FROM users WHERE ref_code = $1', [refCode])
    referrer = r.rows[0] ? Number(r.rows[0].id) : null
  }
  const language = (tg.language_code || '').startsWith('ru') || ['uk', 'be', 'kk'].includes(tg.language_code) ? 'ru' : 'en'
  const data = defaultData()
  // Welcome bonus, bigger if invited
  const gold = referrer ? 800 : 500
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const { rows } = await query(
        `INSERT INTO users (tg_id, username, first_name, last_name, photo_url, tg_premium, language, ref_code, referred_by, gold, gems, data)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        [tg.id, tg.username || null, tg.first_name || 'Player', tg.last_name || null, tg.photo_url || null,
          !!tg.is_premium, language, genRefCode(), referrer, gold, 20, data],
      )
      return { user: rowToUser(rows[0]), isNew: true }
    } catch (err) {
      if (err.code !== '23505' || String(err.constraint).includes('tg_id')) throw err
    }
  }
  throw new Error('Could not allocate referral code')
}

/* ───────────── periodic resets ───────────── */

function syncPeriodic(user) {
  const d = user.data
  const day = today()
  if (d.quests.day !== day) {
    const ids = questsForDay(user.id, day)
    d.quests = { day, items: Object.fromEntries(ids.map((id) => [id, { progress: 0, claimed: false }])) }
  }
  const season = seasonId()
  if (d.pass.season !== season) {
    d.pass = { season, xp: 0, premium: false, free: [], prem: [] }
  }
  if (d.duelRewards.day !== day) d.duelRewards = { day, count: 0 }
}

/* ───────────── rewards ───────────── */

/**
 * Applies a reward object { gold, gems, xp, passXp, boosters, cosmetics } and
 * records what was granted in `summary` for the UI.
 */
export function grant(user, reward = {}, summary = newSummary()) {
  if (!reward) return summary
  if (reward.gold) {
    user.gold += reward.gold
    summary.gold += reward.gold
  }
  if (reward.gems) {
    user.gems += reward.gems
    summary.gems += reward.gems
  }
  for (const [id, n] of Object.entries(reward.boosters || {})) {
    if (!BOOSTERS[id] || !n) continue
    user.data.boosters[id] = (user.data.boosters[id] || 0) + n
    summary.boosters[id] = (summary.boosters[id] || 0) + n
  }
  for (const id of reward.cosmetics || []) {
    if (!findCosmetic(id)) continue
    if (user.data.owned.includes(id)) {
      // Duplicate → compensate
      user.gems += 50
      summary.gems += 50
    } else {
      user.data.owned.push(id)
      summary.cosmetics.push(id)
    }
  }
  if (reward.passXp) addPassXp(user, reward.passXp, summary)
  if (reward.xp) addXp(user, reward.xp, summary)
  return summary
}

export const newSummary = () => ({ gold: 0, gems: 0, xp: 0, passXp: 0, boosters: {}, cosmetics: [], levelUps: [], achievements: [], quests: [] })

function addXp(user, amount, summary) {
  const before = levelFromXp(user.xp).level
  user.xp += amount
  summary.xp += amount
  const after = levelFromXp(user.xp).level
  for (let l = before + 1; l <= after; l++) {
    summary.levelUps.push(l)
    const r = levelUpReward(l)
    user.gold += r.gold
    user.gems += r.gems
    summary.gold += r.gold
    summary.gems += r.gems
  }
}

function addPassXp(user, amount, summary) {
  const max = PASS_TIERS * PASS_XP_PER_TIER
  const before = user.data.pass.xp
  user.data.pass.xp = Math.min(max, before + amount)
  summary.passXp += user.data.pass.xp - before
}

/* ───────────── quests & achievements ───────────── */

/** events: { played, won, sunk, hits, won_hard, won_pvp, campaign_win, accurate_win, played_duel, fast_win } */
export function trackQuests(user, events, summary) {
  const items = user.data.quests.items
  for (const [id, state] of Object.entries(items)) {
    const q = QUESTS.find((x) => x.id === id)
    if (!q || state.progress >= q.target) continue
    const inc = events[q.event] || 0
    if (!inc) continue
    state.progress = Math.min(q.target, state.progress + inc)
    if (state.progress >= q.target) summary.quests.push(id)
  }
}

function statValue(user, stat) {
  const d = user.data
  if (stat === 'peakRating') return Math.max(user.peak_rating, user.rating)
  if (stat === 'cosmetics') return d.owned.length - DEFAULT_OWNED.length
  if (stat === 'campaignStars') return Object.values(d.campaign).reduce((a, b) => a + b, 0)
  return d.stats[stat] || 0
}

export function checkAchievements(user, summary) {
  for (const a of ACHIEVEMENTS) {
    if (user.data.achievements[a.id]) continue
    if (statValue(user, a.stat) >= a.goal) {
      user.data.achievements[a.id] = Date.now()
      summary.achievements.push(a.id)
      grant(user, a.reward, summary)
    }
  }
}

/* ───────────── actions ───────────── */

export function claimDaily(user) {
  const d = user.data.daily
  const day = today()
  if (d.last === day) throw new GameError('already_claimed')
  const streak = d.last && dayDiff(d.last, day) === 1 ? d.streak + 1 : 1
  const reward = DAILY_REWARDS[(streak - 1) % DAILY_REWARDS.length]
  d.streak = streak
  d.last = day
  user.data.stats.bestDailyStreak = Math.max(user.data.stats.bestDailyStreak, streak)
  const summary = grant(user, reward)
  checkAchievements(user, summary)
  return summary
}

export function claimQuest(user, questId) {
  const state = user.data.quests.items[questId]
  const q = QUESTS.find((x) => x.id === questId)
  if (!state || !q) throw new GameError('quest_not_found', 404)
  if (state.claimed) throw new GameError('already_claimed')
  if (state.progress < q.target) throw new GameError('quest_incomplete')
  state.claimed = true
  return grant(user, q.reward)
}

export function claimPass(user, tier, track) {
  const p = user.data.pass
  if (!Number.isInteger(tier) || tier < 1 || tier > PASS_TIERS) throw new GameError('bad_tier')
  if (Math.floor(p.xp / PASS_XP_PER_TIER) < tier) throw new GameError('tier_locked')
  const key = track === 'premium' ? 'prem' : 'free'
  if (key === 'prem' && !p.premium) throw new GameError('premium_required')
  if (p[key].includes(tier)) throw new GameError('already_claimed')
  p[key].push(tier)
  return grant(user, passRewards(tier)[key === 'prem' ? 'premium' : 'free'])
}

/* ───────────── views ───────────── */

export function displayName(u) {
  return [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username || 'Player'
}

export function publicProfile(u) {
  const rank = rankFor(u.rating)
  return {
    id: u.id,
    name: displayName(u),
    username: u.username,
    photo: u.photo_url,
    level: levelFromXp(u.xp).level,
    rating: u.rating,
    peakRating: u.peak_rating,
    rank: rank.id,
    frame: u.data.equipped.frame,
    premium: !!u.data.pass.premium && u.data.pass.season === seasonId(),
    stats: {
      games: u.data.stats.games,
      wins: u.data.stats.wins,
      bestStreak: u.data.stats.bestStreak,
      accuracy: u.data.stats.shots ? Math.round((u.data.stats.hits / u.data.stats.shots) * 100) : 0,
      sunk: u.data.stats.sunk,
    },
    achievements: Object.keys(u.data.achievements).length,
    createdAt: u.created_at,
  }
}

export const isAdmin = (u) => !!u?.tg_id && config.adminIds.includes(String(u.tg_id))

export function selfView(u) {
  const d = u.data
  const lvl = levelFromXp(u.xp)
  const day = today()
  const dailyNextStreak = d.daily.last && dayDiff(d.daily.last, day) === 1 ? d.daily.streak + 1 : 1
  return {
    ...publicProfile(u),
    language: u.language,
    tgPremium: u.tg_premium,
    gold: u.gold,
    gems: u.gems,
    xp: u.xp,
    levelXp: lvl.xpInLevel,
    levelXpNeeded: lvl.xpForLevel,
    refCode: u.ref_code,
    stats: d.stats,
    equipped: d.equipped,
    owned: d.owned,
    boosters: d.boosters,
    campaign: d.campaign,
    campaignNext: CAMPAIGN.find((l) => !d.campaign[l.n])?.n ?? null,
    daily: {
      streak: d.daily.last === day ? d.daily.streak : (dailyNextStreak === 1 ? 0 : d.daily.streak),
      claimedToday: d.daily.last === day,
      nextIndex: d.daily.last === day ? d.daily.streak % DAILY_REWARDS.length : (dailyNextStreak - 1) % DAILY_REWARDS.length,
    },
    quests: Object.entries(d.quests.items).map(([id, s]) => ({ id, ...s })),
    pass: { ...d.pass, endsAt: seasonEnds() },
    achievements: d.achievements,
    settings: d.settings,
    purchases: d.purchases,
    isAdmin: isAdmin(u),
    onboarded: !!d.onboarded || d.stats.games > 0,
    duelRewardsLeft: Math.max(0, DUEL_REWARDS_PER_DAY - (d.duelRewards.day === day ? d.duelRewards.count : 0)),
  }
}

/** Ensures the periodic state (quests/pass) is fresh before showing the profile */
export async function freshSelf(id) {
  const { user } = await mutateUser(id, () => {})
  return selfView(user)
}

/**
 * Deletes the player's personal data on request (Privacy Policy).
 * Personal fields are wiped and the Telegram link is removed; game and payment records
 * stay (anonymised) because they are needed for accounting and other players' history.
 */
export async function deleteAccount(id) {
  await tx(async (c) => {
    await c.query(
      `UPDATE users SET first_name = 'Deleted', last_name = NULL, username = NULL, photo_url = NULL,
         tg_id = NULL, banned = TRUE, ban_reason = 'deleted_by_user',
         data = jsonb_set(data - 'notifyState', '{deletedAt}', to_jsonb(now()))
       WHERE id = $1`,
      [id],
    )
    await c.query('DELETE FROM friendships WHERE a = $1 OR b = $1', [id])
  })
}
