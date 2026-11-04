import { query } from '../db.js'
import { GameError, getUser, displayName } from './users.js'

export const MAX_FRIENDS = 200
const pair = (x, y) => (x < y ? [x, y] : [y, x])

async function row(x, y) {
  const [a, b] = pair(x, y)
  const { rows } = await query('SELECT * FROM friendships WHERE a = $1 AND b = $2', [a, b])
  return rows[0] || null
}

export async function areFriends(x, y) {
  return (await row(x, y))?.status === 'accepted'
}

async function friendCount(id) {
  const { rows } = await query(`SELECT count(*)::int AS n FROM friendships WHERE (a = $1 OR b = $1) AND status = 'accepted'`, [id])
  return rows[0].n
}

/**
 * Sends a friend request (or accepts the other side's pending one).
 * Returns { status: 'requested' | 'accepted', target }
 */
export async function requestFriend(me, otherId) {
  const other = Number(otherId)
  if (!Number.isInteger(other) || other <= 0) throw new GameError('user_not_found', 404)
  if (other === me) throw new GameError('cannot_add_self')
  const target = await getUser(other)
  if (!target || target.banned) throw new GameError('user_not_found', 404)
  const existing = await row(me, other)
  if (existing?.status === 'accepted') throw new GameError('already_friends')
  if (existing && Number(existing.requested_by) === other) {
    await acceptFriend(me, other)
    return { status: 'accepted', target }
  }
  if (existing) throw new GameError('already_requested')
  if ((await friendCount(me)) >= MAX_FRIENDS) throw new GameError('friends_limit')
  const { rows: pend } = await query(`SELECT count(*)::int AS n FROM friendships WHERE requested_by = $1 AND status = 'pending'`, [me])
  if (pend[0].n >= 50) throw new GameError('too_many_requests')
  const [a, b] = pair(me, other)
  await query('INSERT INTO friendships (a, b, status, requested_by) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING', [a, b, 'pending', me])
  return { status: 'requested', target }
}

export async function acceptFriend(me, other) {
  const r = await row(me, Number(other))
  if (!r || r.status !== 'pending' || Number(r.requested_by) === me) throw new GameError('request_not_found', 404)
  if ((await friendCount(me)) >= MAX_FRIENDS) throw new GameError('friends_limit')
  await query(`UPDATE friendships SET status = 'accepted', updated_at = now() WHERE a = $1 AND b = $2`, [r.a, r.b])
}

/** Removes a friend, declines an incoming request or cancels an outgoing one */
export async function removeFriend(me, other) {
  const [a, b] = pair(me, Number(other))
  await query('DELETE FROM friendships WHERE a = $1 AND b = $2', [a, b])
}

export async function makeFriends(x, y) {
  if (!x || !y || x === y) return
  const [a, b] = pair(x, y)
  await query(
    `INSERT INTO friendships (a, b, status, requested_by) VALUES ($1,$2,'accepted',$3)
     ON CONFLICT (a, b) DO UPDATE SET status = 'accepted', updated_at = now()`,
    [a, b, x],
  )
}

/** presence: (id) => { online, inGame } */
export async function listFriends(me, presence = () => ({})) {
  const { rows } = await query(
    `SELECT f.status, f.requested_by, f.created_at AS since, u.*
       FROM friendships f JOIN users u ON u.id = CASE WHEN f.a = $1 THEN f.b ELSE f.a END
      WHERE (f.a = $1 OR f.b = $1) AND NOT u.banned
      ORDER BY u.last_seen DESC`,
    [me],
  )
  const view = (r) => {
    const id = Number(r.id)
    return {
      id,
      name: displayName(r),
      username: r.username,
      photo: r.photo_url,
      level: r.level,
      rating: r.rating,
      frame: r.data?.equipped?.frame || 'frame_none',
      lastSeen: r.last_seen,
      ...presence(id),
    }
  }
  const friends = rows.filter((r) => r.status === 'accepted').map(view)
  friends.sort((x, y) => Number(!!y.online) - Number(!!x.online))
  return {
    friends,
    incoming: rows.filter((r) => r.status === 'pending' && Number(r.requested_by) !== me).map(view),
    outgoing: rows.filter((r) => r.status === 'pending' && Number(r.requested_by) === me).map(view),
  }
}

export async function friendIds(me) {
  const { rows } = await query(
    `SELECT CASE WHEN a = $1 THEN b ELSE a END AS id FROM friendships WHERE (a = $1 OR b = $1) AND status = 'accepted'`,
    [me],
  )
  return rows.map((r) => Number(r.id))
}
