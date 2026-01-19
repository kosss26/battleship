import { query } from '../db/index.js'

/**
 * Модель реферальной системы
 * Согласно ТЗ: приглашающий получает 100 Gold + 10% от побед приглашённого
 */
export const Referral = {
  /**
   * Генерирует реферальный код для пользователя
   */
  async generateCode(userId) {
    // Проверяем, есть ли уже код
    const existing = await query(
      'SELECT referral_code FROM users WHERE id = $1',
      [userId]
    )
    
    if (existing.rows[0]?.referral_code) {
      return existing.rows[0].referral_code
    }

    // Генерируем уникальный код
    const code = `BT${userId.toString(36).toUpperCase()}${Date.now().toString(36).slice(-4).toUpperCase()}`
    
    await query(
      'UPDATE users SET referral_code = $2 WHERE id = $1',
      [userId, code]
    )
    
    return code
  },

  /**
   * Применяет реферальный код
   */
  async applyCode(newUserId, referralCode) {
    // Находим пригласившего
    const referrer = await query(
      'SELECT id FROM users WHERE referral_code = $1',
      [referralCode]
    )
    
    if (!referrer.rows[0]) {
      return { success: false, error: 'Код не найден' }
    }

    const referrerId = referrer.rows[0].id

    // Нельзя пригласить себя
    if (referrerId === newUserId) {
      return { success: false, error: 'Нельзя использовать свой код' }
    }

    // Проверяем, что новый пользователь ещё не использовал код
    const newUser = await query(
      'SELECT referrer_id FROM users WHERE id = $1',
      [newUserId]
    )
    
    if (newUser.rows[0]?.referrer_id) {
      return { success: false, error: 'Вы уже использовали реферальный код' }
    }

    // Применяем код
    await query(
      'UPDATE users SET referrer_id = $2 WHERE id = $1',
      [newUserId, referrerId]
    )

    // Начисляем бонус пригласившему (100 Gold)
    await query(
      'UPDATE users SET gold = gold + 100 WHERE id = $1',
      [referrerId]
    )

    // Записываем в историю
    await query(
      `INSERT INTO referrals (referrer_id, referred_id, bonus_gold)
       VALUES ($1, $2, 100)
       ON CONFLICT DO NOTHING`,
      [referrerId, newUserId]
    )

    return { 
      success: true, 
      message: 'Код применён! Вы и ваш друг получили бонусы' 
    }
  },

  /**
   * Получает список рефералов пользователя
   */
  async getReferrals(userId) {
    const result = await query(
      `SELECT 
        u.id,
        u.username,
        u.first_name,
        u.avatar_url,
        u.rating,
        r.bonus_gold,
        r.created_at as joined_at
       FROM referrals r
       JOIN users u ON r.referred_id = u.id
       WHERE r.referrer_id = $1
       ORDER BY r.created_at DESC`,
      [userId]
    )
    
    return result.rows
  },

  /**
   * Получает статистику рефералов
   */
  async getStats(userId) {
    const result = await query(
      `SELECT 
        COUNT(*) as total_referrals,
        COALESCE(SUM(bonus_gold), 0) as total_bonus
       FROM referrals
       WHERE referrer_id = $1`,
      [userId]
    )
    
    return {
      totalReferrals: parseInt(result.rows[0]?.total_referrals) || 0,
      totalBonus: parseInt(result.rows[0]?.total_bonus) || 0,
    }
  },

  /**
   * Начисляет бонус от победы реферала (10%)
   */
  async processWinBonus(winnerId, winGold) {
    // Находим пригласившего
    const winner = await query(
      'SELECT referrer_id FROM users WHERE id = $1',
      [winnerId]
    )
    
    if (!winner.rows[0]?.referrer_id) {
      return null
    }

    const referrerId = winner.rows[0].referrer_id
    const bonus = Math.floor(winGold * 0.1) // 10% от выигрыша

    if (bonus > 0) {
      // Начисляем бонус
      await query(
        'UPDATE users SET gold = gold + $2 WHERE id = $1',
        [referrerId, bonus]
      )

      // Обновляем общий бонус в referrals
      await query(
        `UPDATE referrals 
         SET bonus_gold = bonus_gold + $3 
         WHERE referrer_id = $1 AND referred_id = $2`,
        [referrerId, winnerId, bonus]
      )
    }

    return { referrerId, bonus }
  },
}

export default Referral
