import { query } from '../db.js'
import {
  MATCH_REWARDS, CAMPAIGN, CAMPAIGN_STAR_GOLD, PREMIUM_GOLD_BONUS, DUEL_REWARDS_PER_DAY, seasonId,
} from '../../../shared/catalog.js'
import { mutateUser, grant, newSummary, trackQuests, checkAchievements, displayName } from './users.js'
import { notifyById } from './notify.js'
import { applyDelta } from './elo.js'

export function campaignStars(level, won, shots) {
  if (!won) return 0
  if (shots <= level.shots3) return 3
  if (shots <= level.shots2) return 2
  return 1
}

/**
 * Applies the outcome of a finished match to one human player.
 * r: { mode, difficulty, level, won, reason, shots, hits, sunk, shipsLost, bestHitChain, ratingDelta }
 */
export async function applyMatchResult(userId, r) {
  const { user, result } = await mutateUser(userId, (u) => {
    const s = u.data.stats
    const summary = newSummary()
    const extra = { ratingDelta: 0, rating: u.rating, stars: 0, newStars: 0, firstClear: false }

    s.games++
    s.shots += r.shots
    s.hits += r.hits
    s.sunk += r.sunk
    s.shipsLost += r.shipsLost
    s.bestHitChain = Math.max(s.bestHitChain, r.bestHitChain || 0)
    // Skill feats only count when the enemy fleet was actually destroyed (not a resignation)
    const fullWin = r.won && r.reason === 'victory'
    if (r.won) {
      s.wins++
      s.streak++
      s.bestStreak = Math.max(s.bestStreak, s.streak)
    }
    if (fullWin) {
      if (r.shipsLost === 0) s.perfectWins++
      if (r.shots < 35) s.fastWins++
      s.fastestWin = s.fastestWin ? Math.min(s.fastestWin, r.shots) : r.shots
    }
    if (!r.won) {
      s.losses++
      s.streak = 0
    }

    let base = { gold: 0, xp: 0 }
    if (r.mode === 'ai') {
      base = MATCH_REWARDS.ai[r.difficulty]?.[r.won ? 'win' : 'loss'] || base
      if (r.won) s[`${r.difficulty}Wins`] = (s[`${r.difficulty}Wins`] || 0) + 1
    } else if (r.mode === 'ranked') {
      base = MATCH_REWARDS.ranked[r.won ? 'win' : 'loss']
      s.pvpGames++
      if (r.won) s.pvpWins++
      u.rating = applyDelta(u.rating, r.ratingDelta)
      extra.ratingDelta = r.ratingDelta
    } else if (r.mode === 'duel') {
      s.duels++
      if (u.data.duelRewards.count < DUEL_REWARDS_PER_DAY) {
        u.data.duelRewards.count++
        base = MATCH_REWARDS.duel[r.won ? 'win' : 'loss']
      }
    } else if (r.mode === 'campaign') {
      const level = CAMPAIGN.find((l) => l.n === r.level)
      if (level && r.won) {
        if (r.difficulty) s[`${level.ai}Wins`] = (s[`${level.ai}Wins`] || 0) + 1
        const prev = u.data.campaign[level.n] || 0
        const stars = campaignStars(level, true, r.shots)
        extra.stars = stars
        if (!prev) {
          extra.firstClear = true
          grant(u, { gold: level.reward.gold, gems: level.reward.gems }, summary)
          base = { gold: 0, xp: level.reward.xp }
        } else base = { gold: 20, xp: 30 }
        if (stars > prev) {
          extra.newStars = stars - prev
          grant(u, { gold: extra.newStars * CAMPAIGN_STAR_GOLD }, summary)
          u.data.campaign[level.n] = stars
        }
      } else base = { gold: 5, xp: 15 }
    }

    const premium = u.data.pass.premium && u.data.pass.season === seasonId()
    const gold = Math.round(base.gold * (premium ? 1 + PREMIUM_GOLD_BONUS : 1))
    grant(u, { gold, xp: base.xp, passXp: base.xp }, summary)

    const accuracy = r.shots ? r.hits / r.shots : 0
    trackQuests(u, {
      played: 1,
      won: r.won ? 1 : 0,
      sunk: r.sunk,
      hits: r.hits,
      won_hard: r.won && ((r.mode === 'ai' && ['hard', 'expert'].includes(r.difficulty)) || (r.mode === 'campaign' && ['hard', 'expert'].includes(r.difficulty))) ? 1 : 0,
      won_pvp: r.won && r.mode === 'ranked' ? 1 : 0,
      campaign_win: r.won && r.mode === 'campaign' ? 1 : 0,
      accurate_win: fullWin && accuracy >= 0.6 ? 1 : 0,
      played_duel: r.mode === 'duel' ? 1 : 0,
      fast_win: fullWin && r.shots < 45 ? 1 : 0,
    }, summary)
    checkAchievements(u, summary)

    extra.rating = u.rating
    extra.referrer = !u.data.refRewarded && u.referred_by ? u.referred_by : null
    if (extra.referrer) u.data.refRewarded = true
    return { summary, extra }
  })

  // Referral reward goes to the inviter once the invitee has played a match
  if (result.extra.referrer) {
    const gems = user.tg_premium ? 25 : 10
    await mutateUser(result.extra.referrer, (inviter) => {
      inviter.data.stats.referrals++
      const s = grant(inviter, { gold: 500, gems })
      checkAchievements(inviter, s)
    }, null, { touch: false })
      .then(() => notifyById(result.extra.referrer, 'referral_joined', { from: displayName(user), gems }))
      .catch((e) => console.error('[referral]', e.message))
  }
  delete result.extra.referrer
  return { user, ...result }
}

export async function saveGame(g) {
  await query(
    `INSERT INTO games (id, mode, difficulty, p1, p2, winner, winner_slot, reason, p1_delta, p2_delta, shots, duration_ms, moves)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [g.id, g.mode, g.difficulty || null, g.p1 || null, g.p2 || null, g.winner || null, g.winnerSlot, g.reason,
      g.p1Delta || 0, g.p2Delta || 0, g.shots, g.durationMs, JSON.stringify(g.moves)],
  ).catch((e) => console.error('[saveGame]', e.message))
}
