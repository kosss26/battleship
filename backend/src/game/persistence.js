import { query, tx } from '../db.js'
import { getUser, selfView, GameError } from '../services/users.js'
import { applyMatchResult, saveGame } from '../services/match.js'
import { eloDelta } from '../services/elo.js'
import { CAMPAIGN } from './constants.js'

export async function persistRoom(state, client) {
  await client.query(`INSERT INTO game_rooms (id,state) VALUES ($1,$2)
    ON CONFLICT(id) DO UPDATE SET state=$2, updated_at=now()`, [state.id, state])
  if (state.phase !== 'over') for (const s of state.seats.filter(s => s.kind === 'human')) {
    const { rows } = await client.query(`INSERT INTO game_room_players(user_id,room_id) VALUES ($1,$2)
      ON CONFLICT(user_id) DO UPDATE SET room_id=EXCLUDED.room_id
      WHERE game_room_players.room_id=EXCLUDED.room_id RETURNING user_id`, [s.userId, state.id])
    if (!rows.length) throw new GameError('already_in_game')
  }
}

export async function savedRooms() {
  const { rows } = await query(`SELECT * FROM game_rooms WHERE settlement IS NULL
    ORDER BY updated_at, id`)
  return rows
}

export async function readSavedRoom(id) {
  return (await query('SELECT * FROM game_rooms WHERE id=$1', [id])).rows[0]
}

export async function savedRoomForUser(userId) {
  return (await query(`SELECT r.* FROM game_room_players p JOIN game_rooms r ON r.id=p.room_id
    WHERE p.user_id=$1`, [userId])).rows[0]
}

export async function pruneSavedRooms() {
  await query(`DELETE FROM game_rooms WHERE settlement IS NOT NULL AND updated_at < now()-interval '7 days'`)
  await query(`DELETE FROM star_invoices i WHERE created_at < now()-interval '30 days'
    AND NOT EXISTS(SELECT 1 FROM payments p WHERE p.payload->>'i'=i.id::text)`)
}

export async function latestResult(userId) {
  const { rows } = await query(`SELECT r.* FROM game_rooms r
    WHERE settlement IS NOT NULL AND updated_at > now()-interval '24 hours'
      AND EXISTS (SELECT 1 FROM jsonb_array_elements(state->'seats') s WHERE s->>'userId'=$1)
      AND NOT EXISTS (SELECT 1 FROM game_result_receipts a WHERE a.room_id=r.id AND a.user_id=$1::bigint)
    ORDER BY updated_at DESC LIMIT 1`, [String(userId)])
  return rows[0]
}

export async function dismissResult(userId, roomId) {
  await query(`INSERT INTO game_result_receipts(user_id,room_id)
    SELECT $1::bigint,id FROM game_rooms WHERE id=$2 AND settlement IS NOT NULL
    AND EXISTS (SELECT 1 FROM jsonb_array_elements(state->'seats') s WHERE s->>'userId'=$1::bigint::text)
    ON CONFLICT DO NOTHING`, [userId, roomId])
}

export const RANKED_GUARD = { maxGamesPerPairPerDay: 3, minShotsForForfeitWin: 12 }

/** Outcome, both wallets, referral reward, history and release of seats commit together. */
export async function settleRoom(room) {
  return tx(async client => {
    const { rows } = await client.query('SELECT settlement FROM game_rooms WHERE id=$1 FOR UPDATE', [room.id])
    if (!rows.length) throw new Error(`Missing durable room ${room.id}`)
    if (rows[0].settlement) return rows[0].settlement
    if (room.phase !== 'over') throw new Error('Cannot settle an unfinished room')
    const ids = room.humans().map(s => s.userId)
    // Referral recipients may also be one of the players; lock all wallets in ID order.
    await client.query(`SELECT id FROM users WHERE id=ANY($1::bigint[])
      OR id IN (SELECT referred_by FROM users WHERE id=ANY($1::bigint[])) ORDER BY id FOR UPDATE`, [ids])
    const players = await Promise.all(room.seats.map(s => s.kind === 'human' ? getUser(s.userId, client) : null))
    const { winnerSeat, reason } = room.result
    const played = room.startedAt != null && reason !== 'server_restart' && !room.demoFleet
    let note = null
    const deltas = [0, 0]
    if (room.mode === 'ranked' && played) {
      const { rows: pair } = await client.query(`SELECT count(*)::int AS n FROM games
        WHERE mode='ranked' AND ended_at > now()-interval '24 hours' AND reason <> 'server_restart'
        AND ((p1=$1 AND p2=$2) OR (p1=$2 AND p2=$1))`, ids)
      if (pair[0].n >= RANKED_GUARD.maxGamesPerPairPerDay) note = 'repeat_opponent'
      else if (reason !== 'victory' && room.moves.length < RANKED_GUARD.minShotsForForfeitWin) note = 'early_forfeit'
      for (let i = 0; i < 2; i++) {
        deltas[i] = eloDelta(players[i].rating, players[1-i].rating, winnerSeat === i ? 1 : 0, players[i].data.stats.pvpGames)
        if (note === 'repeat_opponent' || (note === 'early_forfeit' && i === winnerSeat)) deltas[i] = 0
      }
    }
    const rewards = []
    for (let i = 0; i < 2; i++) {
      const seat = room.seats[i]
      if (seat.kind !== 'human' || !played) { rewards.push(null); continue }
      const r = await applyMatchResult(seat.userId, {
        matchId: room.id, mode: room.mode, difficulty: room.mode === 'campaign' ? CAMPAIGN.find(l => l.n === room.level)?.ai : room.difficulty,
        level: room.level, won: winnerSeat === i, reason, ratingDelta: deltas[i], ratingNote: note, ...room.seatStats(i),
      }, client)
      rewards.push({ summary: r.summary, extra: r.extra, profile: selfView(r.user) })
    }
    const humanId = i => room.seats[i]?.kind === 'human' ? room.seats[i].userId : null
    const durationMs = Math.max(0, room.result.endedAt - (room.startedAt || room.createdAt))
    if (room.startedAt != null && !room.demoFleet) await saveGame({
      id: room.id, mode: room.mode, difficulty: room.difficulty || (room.level ? `L${room.level}` : null),
      p1: humanId(0), p2: humanId(1), winner: humanId(winnerSeat), winnerSlot: winnerSeat,
      reason, p1Delta: deltas[0], p2Delta: deltas[1], shots: room.moves.length, durationMs, moves: room.moves,
    }, client)
    const result = JSON.parse(JSON.stringify({ rewards, durationMs }))
    await client.query('UPDATE game_rooms SET settlement=$2, updated_at=now() WHERE id=$1', [room.id, result])
    await client.query('DELETE FROM game_room_players WHERE room_id=$1', [room.id])
    return result
  })
}
