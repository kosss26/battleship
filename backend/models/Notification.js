import { query } from '../db/index.js'

/**
 * Модель уведомлений
 */
export const Notification = {
  /**
   * Создаёт уведомление
   */
  async create(userId, type, title, message, data = {}) {
    const result = await query(
      `INSERT INTO notifications (user_id, type, title, message, data)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, type, title, message, JSON.stringify(data)]
    )
    return result.rows[0]
  },

  /**
   * Получает уведомления пользователя
   */
  async getUserNotifications(userId, limit = 50, unreadOnly = false) {
    const whereClause = unreadOnly ? 'AND is_read = false' : ''
    
    const result = await query(
      `SELECT * FROM notifications 
       WHERE user_id = $1 ${whereClause}
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    )
    
    return result.rows
  },

  /**
   * Получает количество непрочитанных
   */
  async getUnreadCount(userId) {
    const result = await query(
      'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false',
      [userId]
    )
    return parseInt(result.rows[0]?.count) || 0
  },

  /**
   * Отмечает уведомление как прочитанное
   */
  async markAsRead(notificationId, userId) {
    await query(
      'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2',
      [notificationId, userId]
    )
  },

  /**
   * Отмечает все уведомления как прочитанные
   */
  async markAllAsRead(userId) {
    await query(
      'UPDATE notifications SET is_read = true WHERE user_id = $1',
      [userId]
    )
  },

  /**
   * Создаёт уведомление о достижении
   */
  async notifyAchievement(userId, achievementName, reward) {
    return this.create(
      userId,
      'achievement',
      '🏆 Новое достижение!',
      `Вы получили: ${achievementName}`,
      { achievement: achievementName, reward }
    )
  },

  /**
   * Создаёт уведомление о награде
   */
  async notifyReward(userId, title, gold = 0, gems = 0) {
    const parts = []
    if (gold > 0) parts.push(`${gold} 🪙`)
    if (gems > 0) parts.push(`${gems} 💎`)
    
    return this.create(
      userId,
      'reward',
      '🎁 ' + title,
      `Вы получили: ${parts.join(' + ')}`,
      { gold, gems }
    )
  },

  /**
   * Создаёт системное уведомление
   */
  async notifySystem(userId, title, message) {
    return this.create(userId, 'system', title, message)
  },
}

export default Notification
