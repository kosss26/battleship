import { query } from '../db/index.js'

/**
 * Модель турниров
 * Согласно ТЗ: еженедельные и месячные турниры
 */
export const Tournament = {
  /**
   * Получает список активных турниров
   */
  async getActive() {
    const result = await query(
      `SELECT * FROM tournaments 
       WHERE status = 'active' OR status = 'upcoming'
       ORDER BY start_date ASC`
    )
    return result.rows
  },

  /**
   * Получает турнир по ID
   */
  async findById(id) {
    const result = await query(
      'SELECT * FROM tournaments WHERE id = $1',
      [id]
    )
    return result.rows[0] || null
  },

  /**
   * Создаёт новый турнир
   */
  async create({ name, type, startDate, endDate, entryFeeGems, minRating, maxPlayers, prizePool }) {
    const result = await query(
      `INSERT INTO tournaments (name, type, start_date, end_date, entry_fee_gems, min_rating, max_players, prize_pool)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [name, type, startDate, endDate, entryFeeGems, minRating, maxPlayers, JSON.stringify(prizePool)]
    )
    return result.rows[0]
  },

  /**
   * Регистрирует игрока на турнир
   */
  async join(tournamentId, userId) {
    // Проверяем турнир
    const tournament = await this.findById(tournamentId)
    if (!tournament) {
      return { success: false, error: 'Турнир не найден' }
    }

    if (tournament.status !== 'upcoming' && tournament.status !== 'active') {
      return { success: false, error: 'Регистрация закрыта' }
    }

    // Проверяем, не зарегистрирован ли уже
    const existing = await query(
      'SELECT * FROM tournament_participants WHERE tournament_id = $1 AND user_id = $2',
      [tournamentId, userId]
    )
    
    if (existing.rows.length > 0) {
      return { success: false, error: 'Вы уже зарегистрированы' }
    }

    // Проверяем рейтинг
    const user = await query('SELECT rating, gems FROM users WHERE id = $1', [userId])
    if (!user.rows[0]) {
      return { success: false, error: 'Пользователь не найден' }
    }

    if (user.rows[0].rating < tournament.min_rating) {
      return { success: false, error: `Минимальный рейтинг: ${tournament.min_rating}` }
    }

    // Проверяем и списываем гемы
    if (tournament.entry_fee_gems > 0) {
      if (user.rows[0].gems < tournament.entry_fee_gems) {
        return { success: false, error: 'Недостаточно гемов для участия' }
      }

      await query(
        'UPDATE users SET gems = gems - $2 WHERE id = $1',
        [userId, tournament.entry_fee_gems]
      )
    }

    // Регистрируем участника
    await query(
      `INSERT INTO tournament_participants (tournament_id, user_id)
       VALUES ($1, $2)`,
      [tournamentId, userId]
    )

    return { success: true, message: 'Вы зарегистрированы на турнир!' }
  },

  /**
   * Получает таблицу лидеров турнира
   */
  async getLeaderboard(tournamentId, limit = 100) {
    const result = await query(
      `SELECT 
        tp.*,
        u.username,
        u.first_name,
        u.avatar_url,
        u.rating
       FROM tournament_participants tp
       JOIN users u ON tp.user_id = u.id
       WHERE tp.tournament_id = $1
       ORDER BY tp.points DESC, tp.wins DESC
       LIMIT $2`,
      [tournamentId, limit]
    )
    
    return result.rows.map((row, index) => ({
      ...row,
      rank: index + 1,
    }))
  },

  /**
   * Обновляет результаты участника после матча
   */
  async updateParticipant(tournamentId, userId, isWinner) {
    const points = isWinner ? 3 : 0

    await query(
      `UPDATE tournament_participants 
       SET wins = wins + $3,
           losses = losses + $4,
           points = points + $5
       WHERE tournament_id = $1 AND user_id = $2`,
      [tournamentId, userId, isWinner ? 1 : 0, isWinner ? 0 : 1, points]
    )
  },

  /**
   * Завершает турнир и раздаёт призы
   */
  async finish(tournamentId) {
    const tournament = await this.findById(tournamentId)
    if (!tournament) return null

    // Получаем топ участников
    const leaderboard = await this.getLeaderboard(tournamentId, 10)
    const prizePool = tournament.prize_pool || {}

    // Раздаём призы
    for (const participant of leaderboard) {
      const prize = prizePool[participant.rank.toString()]
      if (prize) {
        await query(
          'UPDATE users SET gold = gold + $2 WHERE id = $1',
          [participant.user_id, prize]
        )
      }
    }

    // Обновляем статус турнира
    await query(
      `UPDATE tournaments SET status = 'finished' WHERE id = $1`,
      [tournamentId]
    )

    return leaderboard
  },

  /**
   * Получает турниры пользователя
   */
  async getUserTournaments(userId) {
    const result = await query(
      `SELECT 
        t.*,
        tp.wins,
        tp.losses,
        tp.points,
        tp.rank
       FROM tournament_participants tp
       JOIN tournaments t ON tp.tournament_id = t.id
       WHERE tp.user_id = $1
       ORDER BY t.start_date DESC`,
      [userId]
    )
    return result.rows
  },
}

export default Tournament
