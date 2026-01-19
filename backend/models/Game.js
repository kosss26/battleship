import { query, getClient } from '../db/index.js'

/**
 * Модель игры
 */
export const Game = {
  /**
   * Создаёт новую игру
   */
  async create({ player1Id, player2Id, player1Board, player2Board, mode }) {
    const result = await query(
      `INSERT INTO games (player1_id, player2_id, player1_board, player2_board, mode, status, started_at)
       VALUES ($1, $2, $3, $4, $5, 'playing', CURRENT_TIMESTAMP)
       RETURNING *`,
      [player1Id, player2Id, JSON.stringify(player1Board), JSON.stringify(player2Board), mode]
    )
    return result.rows[0]
  },

  /**
   * Находит игру по ID
   */
  async findById(id) {
    const result = await query(
      'SELECT * FROM games WHERE id = $1',
      [id]
    )
    return result.rows[0] || null
  },

  /**
   * Добавляет ход в игру
   */
  async addMove(gameId, move) {
    const result = await query(
      `UPDATE games 
       SET moves = moves || $2::jsonb
       WHERE id = $1
       RETURNING *`,
      [gameId, JSON.stringify([move])]
    )
    return result.rows[0]
  },

  /**
   * Обновляет доску игрока
   */
  async updateBoard(gameId, player, board) {
    const column = player === 1 ? 'player1_board' : 'player2_board'
    const result = await query(
      `UPDATE games SET ${column} = $2 WHERE id = $1 RETURNING *`,
      [gameId, JSON.stringify(board)]
    )
    return result.rows[0]
  },

  /**
   * Завершает игру
   */
  async finish(gameId, winnerId, player1RatingAfter, player2RatingAfter) {
    const game = await this.findById(gameId)
    if (!game) return null

    const result = await query(
      `UPDATE games 
       SET status = 'finished',
           winner_id = $2,
           ended_at = CURRENT_TIMESTAMP,
           player1_rating_after = $3,
           player2_rating_after = $4
       WHERE id = $1
       RETURNING *`,
      [gameId, winnerId, player1RatingAfter, player2RatingAfter]
    )
    return result.rows[0]
  },

  /**
   * Получает историю игр пользователя
   */
  async getHistory(userId, limit = 20, offset = 0) {
    const result = await query(
      `SELECT g.*, 
              u1.username as player1_username, u1.first_name as player1_name,
              u2.username as player2_username, u2.first_name as player2_name
       FROM games g
       LEFT JOIN users u1 ON g.player1_id = u1.id
       LEFT JOIN users u2 ON g.player2_id = u2.id
       WHERE (g.player1_id = $1 OR g.player2_id = $1) AND g.status = 'finished'
       ORDER BY g.ended_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    )
    return result.rows
  },

  /**
   * Получает активную игру пользователя
   */
  async getActiveGame(userId) {
    const result = await query(
      `SELECT * FROM games 
       WHERE (player1_id = $1 OR player2_id = $1) AND status = 'playing'
       ORDER BY started_at DESC
       LIMIT 1`,
      [userId]
    )
    return result.rows[0] || null
  },

  /**
   * Получает статистику игр против AI
   */
  async getAIStats(userId) {
    const result = await query(
      `SELECT 
        mode,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE winner_id = $1) as wins
       FROM games 
       WHERE player1_id = $1 
         AND mode IN ('ai_easy', 'ai_medium', 'ai_hard')
         AND status = 'finished'
       GROUP BY mode`,
      [userId]
    )
    return result.rows
  },
}

export default Game
