import { query } from '../db/index.js'

/**
 * Список достижений согласно ТЗ
 */
export const ACHIEVEMENTS = [
  // Категория "Первые шаги"
  { id: 'first_win', name: 'Дебютант', description: 'Выиграй первый матч', icon: '🥉', reward: 50, category: 'beginner' },
  { id: 'hunter_5', name: 'Охотник', description: 'Выиграй 5 матчей', icon: '🥉', reward: 100, category: 'beginner' },
  { id: 'master_50', name: 'Мастер флота', description: 'Выиграй 50 матчей', icon: '🥉', reward: 500, category: 'beginner' },
  
  // Категория "Боевые"
  { id: 'streak_5', name: 'Блиц-король', description: 'Выиграй 5 матчей подряд', icon: '🥈', reward: 200, category: 'combat' },
  { id: 'accuracy_15', name: 'Точность', description: 'Попади 15 раз подряд', icon: '🥈', reward: 200, category: 'combat' },
  { id: 'perfect_game', name: 'Генерал', description: 'Выиграй без промахов', icon: '🥈', reward: 300, category: 'combat' },
  
  // Категория "Высокие достижения"
  { id: 'top_100', name: 'Топ-100', description: 'Попади в топ-100 рейтинга', icon: '🥇', reward: 500, category: 'elite' },
  { id: 'legend_2000', name: 'Легенда', description: 'Достигни рейтинга 2000+', icon: '🥇', reward: 1000, category: 'elite' },
  { id: 'boss_killer', name: 'Босс-киллер', description: 'Выиграй против Hard AI', icon: '🥇', reward: 300, category: 'elite' },
  
  // Категория "AI"
  { id: 'ai_easy_10', name: 'Новичок', description: 'Выиграй 10 раз против Easy AI', icon: '🎮', reward: 100, category: 'ai' },
  { id: 'ai_medium_10', name: 'Опытный', description: 'Выиграй 10 раз против Medium AI', icon: '🎮', reward: 200, category: 'ai' },
  { id: 'ai_hard_10', name: 'Профессионал', description: 'Выиграй 10 раз против Hard AI', icon: '🎮', reward: 500, category: 'ai' },
]

/**
 * Модель достижений
 */
export const Achievement = {
  /**
   * Получает все достижения
   */
  getAll() {
    return ACHIEVEMENTS
  },

  /**
   * Получает достижения пользователя
   */
  async getUserAchievements(userId) {
    const result = await query(
      `SELECT ua.*, a.name, a.description, a.icon_url
       FROM user_achievements ua
       JOIN achievements a ON ua.achievement_id = a.id
       WHERE ua.user_id = $1
       ORDER BY ua.unlocked_at DESC`,
      [userId]
    )
    return result.rows
  },

  /**
   * Проверяет и разблокирует достижение
   */
  async unlock(userId, achievementId) {
    // Проверяем, есть ли уже это достижение
    const existing = await query(
      'SELECT * FROM user_achievements WHERE user_id = $1 AND achievement_id = $2',
      [userId, achievementId]
    )
    
    if (existing.rows.length > 0) {
      return null // Уже разблокировано
    }

    // Получаем ID достижения из БД
    const achievement = await query(
      'SELECT id, reward_gold FROM achievements WHERE name = $1',
      [achievementId]
    )
    
    if (achievement.rows.length === 0) {
      return null
    }

    // Разблокируем достижение
    const result = await query(
      `INSERT INTO user_achievements (user_id, achievement_id)
       VALUES ($1, $2)
       RETURNING *`,
      [userId, achievement.rows[0].id]
    )

    // Добавляем награду
    if (achievement.rows[0].reward_gold > 0) {
      await query(
        'UPDATE users SET gold = gold + $2 WHERE id = $1',
        [userId, achievement.rows[0].reward_gold]
      )
    }

    return {
      ...result.rows[0],
      reward: achievement.rows[0].reward_gold,
    }
  },

  /**
   * Проверяет достижения после игры
   */
  async checkAfterGame(userId, gameResult) {
    const unlockedAchievements = []
    
    // Получаем статистику пользователя
    const stats = await query(
      `SELECT 
        COUNT(*) FILTER (WHERE winner_id = $1) as total_wins,
        COUNT(*) FILTER (WHERE winner_id = $1 AND mode = 'ai_easy') as ai_easy_wins,
        COUNT(*) FILTER (WHERE winner_id = $1 AND mode = 'ai_medium') as ai_medium_wins,
        COUNT(*) FILTER (WHERE winner_id = $1 AND mode = 'ai_hard') as ai_hard_wins
       FROM games 
       WHERE (player1_id = $1 OR player2_id = $1) AND status = 'finished'`,
      [userId]
    )

    const userStats = stats.rows[0]
    const wins = parseInt(userStats.total_wins) || 0

    // Проверяем достижения
    if (wins >= 1) {
      const unlocked = await this.unlock(userId, 'Дебютант')
      if (unlocked) unlockedAchievements.push(unlocked)
    }
    
    if (wins >= 5) {
      const unlocked = await this.unlock(userId, 'Охотник')
      if (unlocked) unlockedAchievements.push(unlocked)
    }
    
    if (wins >= 50) {
      const unlocked = await this.unlock(userId, 'Мастер флота')
      if (unlocked) unlockedAchievements.push(unlocked)
    }

    // AI достижения
    const aiEasyWins = parseInt(userStats.ai_easy_wins) || 0
    const aiMediumWins = parseInt(userStats.ai_medium_wins) || 0
    const aiHardWins = parseInt(userStats.ai_hard_wins) || 0

    if (aiEasyWins >= 10) {
      const unlocked = await this.unlock(userId, 'Новичок')
      if (unlocked) unlockedAchievements.push(unlocked)
    }

    if (aiMediumWins >= 10) {
      const unlocked = await this.unlock(userId, 'Опытный')
      if (unlocked) unlockedAchievements.push(unlocked)
    }

    if (aiHardWins >= 1) {
      const unlocked = await this.unlock(userId, 'Босс-киллер')
      if (unlocked) unlockedAchievements.push(unlocked)
    }

    return unlockedAchievements
  },
}

export default Achievement
