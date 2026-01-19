import { query } from '../db/index.js'

/**
 * Типы ежедневных заданий согласно ТЗ
 */
export const CHALLENGE_TYPES = [
  { 
    id: 'win_3', 
    name: 'Победитель', 
    description: 'Выиграй 3 матча', 
    target: 3, 
    type: 'wins',
    reward: { gold: 100, exp: 50 }
  },
  { 
    id: 'play_5', 
    name: 'Активный игрок', 
    description: 'Сыграй 5 матчей', 
    target: 5, 
    type: 'games',
    reward: { gold: 75, exp: 30 }
  },
  { 
    id: 'sink_10', 
    name: 'Разрушитель', 
    description: 'Потопи 10 кораблей', 
    target: 10, 
    type: 'ships_sunk',
    reward: { gold: 80, exp: 40 }
  },
  { 
    id: 'hits_20', 
    name: 'Снайпер', 
    description: 'Попади 20 раз', 
    target: 20, 
    type: 'hits',
    reward: { gold: 60, exp: 25 }
  },
  { 
    id: 'win_pvp', 
    name: 'Дуэлянт', 
    description: 'Выиграй PvP матч', 
    target: 1, 
    type: 'pvp_wins',
    reward: { gold: 150, exp: 75 }
  },
  { 
    id: 'win_streak_2', 
    name: 'Серия побед', 
    description: 'Выиграй 2 матча подряд', 
    target: 2, 
    type: 'win_streak',
    reward: { gold: 120, exp: 60 }
  },
  { 
    id: 'first_blood', 
    name: 'Первый удар', 
    description: 'Попади первым в матче', 
    target: 1, 
    type: 'first_hit',
    reward: { gold: 50, exp: 20 }
  },
  { 
    id: 'accuracy_70', 
    name: 'Меткость', 
    description: 'Закончи матч с точностью 70%+', 
    target: 1, 
    type: 'high_accuracy',
    reward: { gold: 100, exp: 50 }
  },
]

/**
 * Модель ежедневных заданий
 */
export const DailyChallenge = {
  /**
   * Получает текущие задания пользователя
   */
  async getUserChallenges(userId) {
    const today = new Date().toISOString().split('T')[0]
    
    // Проверяем, есть ли задания на сегодня
    const existing = await query(
      `SELECT * FROM daily_challenges 
       WHERE user_id = $1 AND DATE(created_at) = $2`,
      [userId, today]
    )
    
    if (existing.rows.length > 0) {
      return existing.rows.map(row => ({
        ...row,
        challenge: CHALLENGE_TYPES.find(c => c.id === row.challenge_id),
      }))
    }

    // Генерируем новые задания (3 случайных)
    const challenges = await this.generateDailyChallenges(userId)
    return challenges
  },

  /**
   * Генерирует новые ежедневные задания
   */
  async generateDailyChallenges(userId) {
    // Выбираем 3 случайных задания
    const shuffled = [...CHALLENGE_TYPES].sort(() => Math.random() - 0.5)
    const selected = shuffled.slice(0, 3)
    
    const challenges = []
    
    for (const challenge of selected) {
      const result = await query(
        `INSERT INTO daily_challenges (user_id, challenge_id, target, progress, reward_gold, reward_exp)
         VALUES ($1, $2, $3, 0, $4, $5)
         RETURNING *`,
        [userId, challenge.id, challenge.target, challenge.reward.gold, challenge.reward.exp]
      )
      
      challenges.push({
        ...result.rows[0],
        challenge,
      })
    }
    
    return challenges
  },

  /**
   * Обновляет прогресс задания
   */
  async updateProgress(userId, challengeType, increment = 1) {
    const today = new Date().toISOString().split('T')[0]
    
    // Находим задания с этим типом
    const matchingChallenges = CHALLENGE_TYPES.filter(c => c.type === challengeType)
    
    const updated = []
    
    for (const challenge of matchingChallenges) {
      const result = await query(
        `UPDATE daily_challenges 
         SET progress = LEAST(progress + $4, target)
         WHERE user_id = $1 
           AND challenge_id = $2 
           AND DATE(created_at) = $3
           AND NOT completed
         RETURNING *`,
        [userId, challenge.id, today, increment]
      )
      
      if (result.rows[0]) {
        updated.push({
          ...result.rows[0],
          challenge,
        })
      }
    }
    
    return updated
  },

  /**
   * Проверяет и завершает выполненные задания
   */
  async checkCompletion(userId) {
    const today = new Date().toISOString().split('T')[0]
    
    // Находим завершённые, но не отмеченные задания
    const completed = await query(
      `SELECT * FROM daily_challenges 
       WHERE user_id = $1 
         AND DATE(created_at) = $2
         AND progress >= target
         AND NOT completed`,
      [userId, today]
    )
    
    const rewards = { gold: 0, exp: 0 }
    const completedChallenges = []
    
    for (const row of completed.rows) {
      // Отмечаем как завершённое
      await query(
        `UPDATE daily_challenges SET completed = true WHERE id = $1`,
        [row.id]
      )
      
      // Начисляем награды
      await query(
        `UPDATE users 
         SET gold = gold + $2
         WHERE id = $1`,
        [userId, row.reward_gold]
      )
      
      rewards.gold += row.reward_gold
      rewards.exp += row.reward_exp
      
      const challenge = CHALLENGE_TYPES.find(c => c.id === row.challenge_id)
      completedChallenges.push(challenge)
    }
    
    return { rewards, completedChallenges }
  },

  /**
   * Сбрасывает задания (вызывается в полночь)
   */
  async resetDaily() {
    // Задания автоматически сбрасываются, т.к. проверяем по дате
    // Можно добавить очистку старых записей
    const result = await query(
      `DELETE FROM daily_challenges 
       WHERE DATE(created_at) < CURRENT_DATE - INTERVAL '7 days'`
    )
    
    return result.rowCount
  },
}

export default DailyChallenge
