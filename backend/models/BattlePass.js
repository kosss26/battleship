import { query } from '../db/index.js'

/**
 * Награды Battle Pass по уровням
 * Согласно ТЗ: бесплатные и премиум награды
 */
export const BATTLE_PASS_REWARDS = [
  { level: 1, free: { gold: 50 }, premium: { gold: 100, gems: 5 } },
  { level: 2, free: { gold: 75 }, premium: { gold: 150 } },
  { level: 3, free: null, premium: { skin: 'skin_military' } },
  { level: 4, free: { gold: 100 }, premium: { gold: 200, gems: 10 } },
  { level: 5, free: { gems: 5 }, premium: { gems: 20 } },
  { level: 6, free: { gold: 100 }, premium: { gold: 200 } },
  { level: 7, free: null, premium: { skin: 'board_arctic' } },
  { level: 8, free: { gold: 125 }, premium: { gold: 250, gems: 15 } },
  { level: 9, free: { gold: 150 }, premium: { gold: 300 } },
  { level: 10, free: { gems: 10 }, premium: { gems: 30, skin: 'skin_neon' } },
  { level: 11, free: { gold: 150 }, premium: { gold: 300 } },
  { level: 12, free: null, premium: { skin: 'board_night' } },
  { level: 13, free: { gold: 175 }, premium: { gold: 350, gems: 20 } },
  { level: 14, free: { gold: 200 }, premium: { gold: 400 } },
  { level: 15, free: { gems: 15 }, premium: { gems: 40 } },
  { level: 16, free: { gold: 200 }, premium: { gold: 400 } },
  { level: 17, free: null, premium: { skin: 'skin_pirate' } },
  { level: 18, free: { gold: 225 }, premium: { gold: 450, gems: 25 } },
  { level: 19, free: { gold: 250 }, premium: { gold: 500 } },
  { level: 20, free: { gems: 20 }, premium: { gems: 50, skin: 'skin_golden' } },
]

/**
 * Модель Battle Pass
 */
export const BattlePass = {
  /**
   * Получает текущий активный Battle Pass
   */
  async getCurrent() {
    const result = await query(
      `SELECT * FROM battle_passes 
       WHERE status = 'active' 
       AND CURRENT_TIMESTAMP BETWEEN start_date AND end_date
       LIMIT 1`
    )
    
    if (result.rows[0]) {
      return {
        ...result.rows[0],
        rewards: BATTLE_PASS_REWARDS,
      }
    }
    
    // Возвращаем дефолтный Battle Pass если нет в БД
    return {
      id: 'default',
      name: 'Сезон 1: Морские легенды',
      season: 1,
      start_date: new Date().toISOString(),
      end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      premium_price_gems: 500,
      rewards: BATTLE_PASS_REWARDS,
      status: 'active',
    }
  },

  /**
   * Получает прогресс пользователя в Battle Pass
   */
  async getUserProgress(userId) {
    const battlePass = await this.getCurrent()
    
    const result = await query(
      `SELECT * FROM user_battle_pass 
       WHERE user_id = $1 AND battle_pass_id = $2`,
      [userId, battlePass.id]
    )
    
    if (result.rows[0]) {
      return {
        ...result.rows[0],
        battlePass,
      }
    }
    
    // Создаём запись для пользователя
    try {
      const newProgress = await query(
        `INSERT INTO user_battle_pass (user_id, battle_pass_id)
         VALUES ($1, $2)
         RETURNING *`,
        [userId, battlePass.id]
      )
      
      return {
        ...newProgress.rows[0],
        battlePass,
      }
    } catch (error) {
      // Возвращаем дефолтный прогресс
      return {
        level: 1,
        exp: 0,
        is_premium: false,
        claimed_rewards: [],
        battlePass,
      }
    }
  },

  /**
   * Добавляет опыт в Battle Pass
   */
  async addExp(userId, exp) {
    const EXP_PER_LEVEL = 100
    const MAX_LEVEL = 20
    
    const progress = await this.getUserProgress(userId)
    const currentExp = (progress.exp || 0) + exp
    let currentLevel = progress.level || 1
    
    // Расчёт нового уровня
    while (currentExp >= EXP_PER_LEVEL && currentLevel < MAX_LEVEL) {
      currentLevel++
    }
    
    const remainingExp = currentExp % EXP_PER_LEVEL
    
    try {
      await query(
        `UPDATE user_battle_pass 
         SET level = $2, exp = $3
         WHERE user_id = $1 AND battle_pass_id = $4`,
        [userId, currentLevel, remainingExp, progress.battlePass.id]
      )
    } catch (error) {
      console.error('Error updating battle pass exp:', error)
    }
    
    return {
      level: currentLevel,
      exp: remainingExp,
      leveledUp: currentLevel > (progress.level || 1),
    }
  },

  /**
   * Покупает премиум Battle Pass
   */
  async buyPremium(userId) {
    const progress = await this.getUserProgress(userId)
    
    if (progress.is_premium) {
      return { success: false, error: 'У вас уже есть премиум Battle Pass' }
    }
    
    const price = progress.battlePass.premium_price_gems || 500
    
    // Проверяем баланс
    const user = await query('SELECT gems FROM users WHERE id = $1', [userId])
    if (!user.rows[0] || user.rows[0].gems < price) {
      return { success: false, error: 'Недостаточно гемов' }
    }
    
    // Списываем гемы
    await query(
      'UPDATE users SET gems = gems - $2 WHERE id = $1',
      [userId, price]
    )
    
    // Активируем премиум
    await query(
      `UPDATE user_battle_pass 
       SET is_premium = true
       WHERE user_id = $1 AND battle_pass_id = $2`,
      [userId, progress.battlePass.id]
    )
    
    return { success: true, message: 'Премиум Battle Pass активирован!' }
  },

  /**
   * Забирает награду за уровень
   */
  async claimReward(userId, level, isPremium) {
    const progress = await this.getUserProgress(userId)
    
    // Проверяем, достигнут ли уровень
    if (progress.level < level) {
      return { success: false, error: 'Уровень ещё не достигнут' }
    }
    
    // Проверяем премиум для премиум наград
    if (isPremium && !progress.is_premium) {
      return { success: false, error: 'Нужен премиум Battle Pass' }
    }
    
    // Проверяем, не забрана ли уже награда
    const claimedKey = `${level}_${isPremium ? 'premium' : 'free'}`
    const claimed = progress.claimed_rewards || []
    
    if (claimed.includes(claimedKey)) {
      return { success: false, error: 'Награда уже получена' }
    }
    
    // Получаем награду
    const rewardData = BATTLE_PASS_REWARDS[level - 1]
    const reward = isPremium ? rewardData?.premium : rewardData?.free
    
    if (!reward) {
      return { success: false, error: 'Награда не найдена' }
    }
    
    // Начисляем награды
    if (reward.gold) {
      await query(
        'UPDATE users SET gold = gold + $2 WHERE id = $1',
        [userId, reward.gold]
      )
    }
    
    if (reward.gems) {
      await query(
        'UPDATE users SET gems = gems + $2 WHERE id = $1',
        [userId, reward.gems]
      )
    }
    
    if (reward.skin) {
      // Добавляем скин пользователю
      await query(
        `INSERT INTO user_skins (user_id, skin_id)
         SELECT $1, id FROM skins WHERE name = $2
         ON CONFLICT DO NOTHING`,
        [userId, reward.skin]
      )
    }
    
    // Отмечаем награду как полученную
    claimed.push(claimedKey)
    await query(
      `UPDATE user_battle_pass 
       SET claimed_rewards = $2
       WHERE user_id = $1 AND battle_pass_id = $3`,
      [userId, JSON.stringify(claimed), progress.battlePass.id]
    )
    
    return { success: true, reward }
  },
}

export default BattlePass
