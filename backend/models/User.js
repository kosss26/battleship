import { query } from '../db/index.js'

/**
 * Модель пользователя
 */
export const User = {
  /**
   * Находит пользователя по Telegram ID
   */
  async findByTelegramId(telegramId) {
    const result = await query(
      'SELECT * FROM users WHERE telegram_id = $1',
      [telegramId]
    )
    return result.rows[0] || null
  },

  /**
   * Находит пользователя по ID
   */
  async findById(id) {
    const result = await query(
      'SELECT * FROM users WHERE id = $1',
      [id]
    )
    return result.rows[0] || null
  },

  /**
   * Создаёт нового пользователя
   */
  async create({ telegramId, username, firstName, lastName, avatarUrl, referrerId }) {
    const result = await query(
      `INSERT INTO users (telegram_id, username, first_name, last_name, avatar_url, referrer_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [telegramId, username, firstName, lastName, avatarUrl, referrerId]
    )
    return result.rows[0]
  },

  /**
   * Обновляет данные пользователя
   */
  async update(id, { username, firstName, lastName, avatarUrl }) {
    const result = await query(
      `UPDATE users 
       SET username = COALESCE($2, username),
           first_name = COALESCE($3, first_name),
           last_name = COALESCE($4, last_name),
           avatar_url = COALESCE($5, avatar_url),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id, username, firstName, lastName, avatarUrl]
    )
    return result.rows[0]
  },

  /**
   * Обновляет рейтинг пользователя
   */
  async updateRating(id, newRating) {
    const result = await query(
      `UPDATE users SET rating = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
      [id, Math.max(0, newRating)]
    )
    return result.rows[0]
  },

  /**
   * Добавляет валюту пользователю
   */
  async addCurrency(id, { gold = 0, gems = 0 }) {
    const result = await query(
      `UPDATE users 
       SET gold = gold + $2, gems = gems + $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id, gold, gems]
    )
    return result.rows[0]
  },

  /**
   * Добавляет опыт и проверяет повышение уровня
   */
  async addExperience(id, exp) {
    // Простая формула: 100 * level опыта для повышения
    const user = await this.findById(id)
    if (!user) return null

    const currentExp = (user.experience || 0) + exp
    const expForNextLevel = user.level * 100
    let newLevel = user.level

    if (currentExp >= expForNextLevel) {
      newLevel = user.level + 1
    }

    const result = await query(
      `UPDATE users 
       SET level = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id, newLevel]
    )
    return result.rows[0]
  },

  /**
   * Получает статистику пользователя
   */
  async getStats(userId) {
    const result = await query(
      `SELECT 
        COUNT(*) as total_matches,
        COUNT(*) FILTER (WHERE winner_id = $1) as wins,
        COUNT(*) FILTER (WHERE winner_id IS NOT NULL AND winner_id != $1) as losses
       FROM games 
       WHERE (player1_id = $1 OR player2_id = $1) AND status = 'finished'`,
      [userId]
    )
    
    const stats = result.rows[0]
    const totalMatches = parseInt(stats.total_matches) || 0
    const wins = parseInt(stats.wins) || 0
    const losses = parseInt(stats.losses) || 0
    
    return {
      totalMatches,
      wins,
      losses,
      winRate: totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0,
    }
  },

  /**
   * Получает топ игроков по рейтингу
   */
  async getLeaderboard(limit = 100, offset = 0) {
    const result = await query(
      `SELECT id, username, first_name, avatar_url, rating, level
       FROM users
       WHERE is_banned = false
       ORDER BY rating DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    )
    return result.rows
  },

  /**
   * Получает позицию пользователя в рейтинге
   */
  async getRank(userId) {
    const result = await query(
      `SELECT COUNT(*) + 1 as rank
       FROM users
       WHERE rating > (SELECT rating FROM users WHERE id = $1)
         AND is_banned = false`,
      [userId]
    )
    return parseInt(result.rows[0]?.rank) || 0
  },
}

export default User
