/**
 * Rewarded ads (Adsgram).
 * Flow: start (server creates a session) → the client shows the ad → complete (server grants).
 * If ADSGRAM_REWARD_SECRET is set, `complete` also requires Adsgram's server-to-server reward
 * callback for that session, so a modified client cannot claim rewards without watching.
 */
import crypto from 'crypto'
import { query } from '../db.js'
import { config } from '../config.js'
import {
  AD_PLACEMENTS, AD_DAILY_LIMIT, AD_COOLDOWN_MS, AD_MIN_WATCH_MS, AD_DOUBLE_WINDOW_MS,
} from '../../../shared/catalog.js'
import { mutateUser, grant, newSummary, GameError, today } from './users.js'

export const adsEnabled = () => !!config.adsgramBlockId || config.allowDevLogin
export const verifiedMode = () => !!config.adsgramRewardSecret

function dayState(u) {
  if (u.data.ads?.day !== today()) u.data.ads = { day: today(), counts: {}, total: 0, lastAt: u.data.ads?.lastAt || 0 }
  return u.data.ads
}

function doubleAmount(u) {
  const lm = u.data.lastMatch
  if (!lm || lm.doubled || Date.now() - lm.at > AD_DOUBLE_WINDOW_MS) return 0
  return Math.min(lm.gold, AD_PLACEMENTS.double.maxGold)
}

export function startAd(u, placement) {
  if (!adsEnabled()) throw new GameError('ads_unavailable', 503)
  const p = AD_PLACEMENTS[placement]
  if (!p) throw new GameError('bad_placement')
  const ads = dayState(u)
  if (ads.total >= AD_DAILY_LIMIT || (ads.counts[placement] || 0) >= p.daily) throw new GameError('ad_limit')
  if (Date.now() - (ads.lastAt || 0) < AD_COOLDOWN_MS) throw new GameError('ad_cooldown')
  if (placement === 'double' && !doubleAmount(u)) throw new GameError('nothing_to_double')
  ads.session = { id: crypto.randomUUID(), placement, at: Date.now(), verified: false }
  return { sessionId: ads.session.id, blockId: config.adsgramBlockId || null, fake: !config.adsgramBlockId }
}

export function completeAd(u, sessionId) {
  const ads = dayState(u)
  const s = ads.session
  if (!s || s.id !== sessionId) throw new GameError('ad_session_invalid')
  const age = Date.now() - s.at
  if (age > 10 * 60_000) throw new GameError('ad_session_invalid')
  if (age < AD_MIN_WATCH_MS) throw new GameError('ad_too_fast')
  if (verifiedMode() && !s.verified) throw new GameError('ad_not_confirmed')
  const summary = newSummary()
  if (s.placement === 'double') {
    const gold = doubleAmount(u)
    if (!gold) throw new GameError('nothing_to_double')
    grant(u, { gold }, summary)
    u.data.lastMatch.doubled = true
  } else {
    grant(u, AD_PLACEMENTS[s.placement].reward, summary)
  }
  ads.counts[s.placement] = (ads.counts[s.placement] || 0) + 1
  ads.total++
  ads.lastAt = Date.now()
  const placement = s.placement
  const verified = s.verified
  ads.session = null
  return { summary, placement, verified }
}

export async function logAdView(userId, placement, verified) {
  await query('INSERT INTO ad_views (user_id, placement, verified) VALUES ($1,$2,$3)', [userId, placement, verified]).catch(() => {})
}

/** Adsgram reward URL callback: ?userid=<telegram id>&secret=<ADSGRAM_REWARD_SECRET> */
export async function adsgramCallback(tgId, secret) {
  if (!verifiedMode()) return false
  const a = Buffer.from(String(secret || ''))
  const b = Buffer.from(config.adsgramRewardSecret)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false
  const { rows } = await query('SELECT id FROM users WHERE tg_id = $1', [tgId])
  if (!rows[0]) return false
  await mutateUser(Number(rows[0].id), (u) => {
    const s = u.data.ads?.session
    if (s && !s.verified) s.verified = true
  }, null, { touch: false })
  return true
}
