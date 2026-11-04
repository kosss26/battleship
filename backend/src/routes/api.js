import express from 'express'
import jwt from 'jsonwebtoken'
import { config } from '../config.js'
import { query } from '../db.js'
import { verifyInitData, appLink } from '../telegram.js'
import {
  upsertTelegramUser, getUser, mutateUser, selfView, publicProfile, freshSelf, displayName,
  claimDaily, claimQuest, claimPass, GameError, deleteAccount,
} from '../services/users.js'
import { buyItem, equip } from '../services/shop.js'
import { createStarInvoice, handleUpdate } from '../services/bot.js'
import { notifyProfile, presence, isOnline, emitToUser as emitFriends, kickUser } from '../game/manager.js'
import { listFriends, requestFriend, acceptFriend, removeFriend, makeFriends, friendIds } from '../services/friends.js'
import { notifyById, clearBlocked } from '../services/notify.js'
import { START_PARAM } from '../../../shared/catalog.js'
import adminRouter from './admin.js'
import { unclaimedResult, seasonHistory, claimSeason, currentSeasonProgress } from '../services/seasons.js'
import { seasonInfo } from '../../../shared/catalog.js'

const router = express.Router()

/** Own profile plus an unclaimed season result, if any */
const fullSelf = async (id) => ({ ...(await freshSelf(id)), seasonResult: await unclaimedResult(id) })

const sign = (userId) => jwt.sign({ uid: userId }, config.jwtSecret, { expiresIn: '30d' })

/* ───────── helpers ───────── */

const wrap = (fn) => async (req, res) => {
  try {
    await fn(req, res)
  } catch (e) {
    if (e instanceof GameError) return res.status(e.status).json({ error: e.code })
    console.error('[api]', req.method, req.path, e)
    res.status(500).json({ error: 'server_error' })
  }
}

function auth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  try {
    req.userId = Number(jwt.verify(token, config.jwtSecret).uid)
    next()
  } catch {
    res.status(401).json({ error: 'unauthorized' })
  }
}

/** Simple in-memory rate limiter per IP+route bucket */
function rateLimit(limit, windowMs) {
  const hits = new Map()
  setInterval(() => hits.clear(), windowMs).unref()
  return (req, res, next) => {
    const key = `${req.ip}:${req.userId || ''}`
    const n = (hits.get(key) || 0) + 1
    hits.set(key, n)
    if (n > limit) return res.status(429).json({ error: 'rate_limited' })
    next()
  }
}

/** Runs a mutation and returns { profile, summary } */
const mutation = (fn) => wrap(async (req, res) => {
  const { user, result } = await mutateUser(req.userId, (u) => fn(u, req))
  const profile = selfView(user)
  notifyProfile(req.userId, profile)
  res.json({ profile, summary: result || null })
})

/* ───────── public ───────── */

router.get('/health', (req, res) => res.json({ ok: true }))

router.get('/config', (req, res) => {
  res.json({
    botUsername: config.botUsername || null,
    appLink: appLink(),
    devLogin: config.allowDevLogin,
    payments: !!config.botToken,
    legal: { operator: config.legalOperator, contact: config.legalContact },
  })
})

router.post('/telegram/webhook', (req, res) => {
  if (config.webhookSecret && req.get('X-Telegram-Bot-Api-Secret-Token') !== config.webhookSecret) {
    return res.sendStatus(401)
  }
  res.sendStatus(200)
  handleUpdate(req.body).catch((e) => console.error('[bot] update', e.message))
})

/* ───────── auth ───────── */

function refFrom(startParam, fallback) {
  const p = startParam || ''
  if (p.startsWith(START_PARAM.ref)) return p.slice(START_PARAM.ref.length)
  return fallback || null
}

router.post('/auth/telegram', rateLimit(30, 60_000), wrap(async (req, res) => {
  const verified = verifyInitData(req.body?.initData)
  if (!verified) return res.status(401).json({ error: 'invalid_init_data' })
  const { user, isNew } = await upsertTelegramUser(verified.user, { refCode: refFrom(verified.startParam, req.body?.ref) })
  if (user.banned) return res.status(403).json({ error: 'banned' })
  if (isNew && user.referred_by) await makeFriends(user.id, user.referred_by)
  if (!isNew) clearBlocked(user.id).catch(() => {})
  res.json({ token: sign(user.id), profile: await fullSelf(user.id), isNew, startParam: verified.startParam })
}))

/** Browser login for local development only */
router.post('/auth/dev', wrap(async (req, res) => {
  if (!config.allowDevLogin) return res.status(404).json({ error: 'not_found' })
  const name = String(req.body?.name || 'Captain').slice(0, 32)
  const devId = 9_000_000_000 + (Math.abs([...name].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) | 0, 7)) % 1_000_000)
  const { user, isNew } = await upsertTelegramUser(
    { id: devId, first_name: name, language_code: req.body?.lang || 'ru' },
    { refCode: req.body?.ref },
  )
  if (isNew && user.referred_by) await makeFriends(user.id, user.referred_by)
  res.json({ token: sign(user.id), profile: await fullSelf(user.id), isNew })
}))

/* ───────── me ───────── */

router.use('/me', auth, rateLimit(120, 60_000))

router.get('/me', wrap(async (req, res) => res.json({ profile: await fullSelf(req.userId) })))

/* ───────── seasons ───────── */

router.get('/me/seasons', wrap(async (req, res) => {
  res.json({ current: seasonInfo(), progress: await currentSeasonProgress(req.userId), history: await seasonHistory(req.userId) })
}))

router.post('/me/season/claim', wrap(async (req, res) => {
  const { user, summary } = await claimSeason(req.userId, String(req.body?.season || ''))
  const profile = { ...selfView(user), seasonResult: await unclaimedResult(req.userId) }
  notifyProfile(req.userId, profile)
  res.json({ profile, summary })
}))

/* ───────── account deletion ───────── */

router.post('/me/delete', wrap(async (req, res) => {
  if (req.body?.confirm !== 'DELETE') return res.status(400).json({ error: 'confirmation_required' })
  await deleteAccount(req.userId)
  kickUser(req.userId)
  res.json({ ok: true })
}))

router.patch('/me/settings', mutation((u, req) => {
  const { language, sound, haptics, music, notify } = req.body || {}
  if (language && ['ru', 'en'].includes(language)) u.language = language
  for (const [k, v] of Object.entries({ sound, haptics, music, notify })) if (typeof v === 'boolean') u.data.settings[k] = v
}))

router.post('/me/onboarded', mutation((u) => {
  u.data.onboarded = true
}))

/* ───────── friends ───────── */

router.get('/me/friends', wrap(async (req, res) => res.json(await listFriends(req.userId, presence))))

router.post('/me/friends', wrap(async (req, res) => {
  const me = await getUser(req.userId)
  const { status, target } = await requestFriend(req.userId, Number(req.body?.id))
  const from = displayName(me)
  if (status === 'requested') {
    emitFriends(target.id, 'friend:request', { from: publicProfile(me) })
    if (!isOnline(target.id)) notifyById(target.id, 'friend_request', { from })
  } else {
    emitFriends(target.id, 'friend:accepted', { from: publicProfile(me) })
    if (!isOnline(target.id)) notifyById(target.id, 'friend_accepted', { from })
  }
  res.json({ status, ...(await listFriends(req.userId, presence)) })
}))

router.post('/me/friends/:id/accept', wrap(async (req, res) => {
  const other = Number(req.params.id)
  await acceptFriend(req.userId, other)
  const me = await getUser(req.userId)
  emitFriends(other, 'friend:accepted', { from: publicProfile(me) })
  if (!isOnline(other)) notifyById(other, 'friend_accepted', { from: displayName(me) })
  res.json(await listFriends(req.userId, presence))
}))

router.delete('/me/friends/:id', wrap(async (req, res) => {
  await removeFriend(req.userId, Number(req.params.id))
  res.json(await listFriends(req.userId, presence))
}))

router.post('/me/equip', mutation((u, req) => equip(u, String(req.body?.itemId || ''))))
router.post('/me/daily', mutation((u) => claimDaily(u)))
router.post('/me/quests/:id/claim', mutation((u, req) => claimQuest(u, req.params.id)))
router.post('/me/pass/claim', mutation((u, req) => claimPass(u, Number(req.body?.tier), req.body?.track)))
router.post('/me/shop/buy', mutation((u, req) => buyItem(u, String(req.body?.itemId || ''), Number(req.body?.qty) || 1)))

router.post('/me/invoice', wrap(async (req, res) => {
  if (!config.botToken) return res.status(503).json({ error: 'payments_unavailable' })
  const user = await getUser(req.userId)
  const link = await createStarInvoice(user, String(req.body?.productId || ''))
  res.json({ link })
}))

router.get('/me/history', wrap(async (req, res) => {
  const { rows } = await query(
    `SELECT g.id, g.mode, g.difficulty, g.reason, g.shots, g.duration_ms, g.ended_at, g.p1, g.p2, g.winner,
            g.p1_delta, g.p2_delta,
            CASE WHEN g.p1 = $1 THEN u2.first_name ELSE u1.first_name END AS opponent_name
       FROM games g
       LEFT JOIN users u1 ON u1.id = g.p1
       LEFT JOIN users u2 ON u2.id = g.p2
      WHERE g.p1 = $1 OR g.p2 = $1
      ORDER BY g.ended_at DESC LIMIT 30`,
    [req.userId],
  )
  res.json({
    games: rows.map((g) => ({
      id: g.id,
      mode: g.mode,
      difficulty: g.difficulty,
      won: Number(g.winner) === req.userId,
      reason: g.reason,
      shots: g.shots,
      durationMs: g.duration_ms,
      endedAt: g.ended_at,
      opponent: g.opponent_name,
      ratingDelta: Number(g.p1) === req.userId ? g.p1_delta : g.p2_delta,
    })),
  })
}))

router.get('/me/referrals', wrap(async (req, res) => {
  const me = await getUser(req.userId)
  const { rows } = await query(
    `SELECT id, first_name, last_name, username, photo_url, level, rating, games, created_at
       FROM users WHERE referred_by = $1 ORDER BY created_at DESC LIMIT 100`,
    [req.userId],
  )
  res.json({
    link: appLink(`${START_PARAM.ref}${me.ref_code}`),
    code: me.ref_code,
    total: rows.length,
    active: rows.filter((r) => r.games > 0).length,
    friends: rows.map((r) => ({
      id: Number(r.id),
      name: [r.first_name, r.last_name].filter(Boolean).join(' '),
      photo: r.photo_url,
      level: r.level,
      rating: r.rating,
      active: r.games > 0,
    })),
  })
}))

router.get('/duel-link/:code', auth, (req, res) => {
  res.json({ link: appLink(`${START_PARAM.duel}${String(req.params.code).replace(/\D/g, '')}`) })
})

/* ───────── leaderboards & profiles ───────── */

router.get('/leaderboard', auth, rateLimit(60, 60_000), wrap(async (req, res) => {
  const type = req.query.type || 'rating'
  const me = await getUser(req.userId)
  let rows
  if (type === 'weekly') {
    ;({ rows } = await query(
      `SELECT u.*, count(*)::int AS score FROM games g JOIN users u ON u.id = g.winner
        WHERE g.ended_at >= date_trunc('week', now()) AND NOT u.banned
        GROUP BY u.id ORDER BY score DESC, u.rating DESC LIMIT 100`,
    ))
  } else if (type === 'friends') {
    const ids = [req.userId, ...(await friendIds(req.userId))]
    ;({ rows } = await query(
      `SELECT u.*, u.rating AS score FROM users u WHERE u.id = ANY($1) AND NOT u.banned ORDER BY u.rating DESC LIMIT 200`,
      [ids],
    ))
  } else {
    ;({ rows } = await query(
      `SELECT u.*, u.rating AS score FROM users u WHERE u.games > 0 AND NOT u.banned
        ORDER BY u.rating DESC, u.wins DESC LIMIT 100`,
    ))
  }
  const { rows: pos } = await query(
    'SELECT count(*)::int + 1 AS pos FROM users WHERE games > 0 AND NOT banned AND rating > $1',
    [me.rating],
  )
  res.json({
    type,
    season: seasonInfo(),
    progress: type === 'rating' ? await currentSeasonProgress(req.userId) : null,
    entries: rows.map((r, i) => ({
      place: i + 1,
      id: Number(r.id),
      name: [r.first_name, r.last_name].filter(Boolean).join(' '),
      photo: r.photo_url,
      level: r.level,
      rating: r.rating,
      score: r.score,
      frame: r.data?.equipped?.frame || 'frame_none',
      me: Number(r.id) === req.userId,
    })),
    myPlace: pos[0].pos,
    myRating: me.rating,
  })
}))

router.use('/admin', adminRouter({ auth, wrap }))

router.get('/users/:id', auth, wrap(async (req, res) => {
  const u = await getUser(Number(req.params.id))
  if (!u || u.banned) return res.status(404).json({ error: 'not_found' })
  res.json({ profile: publicProfile(u) })
}))

export default router
