import express from 'express'
import Notification from '../models/Notification.js'

const router = express.Router()

/**
 * GET /api/notifications
 * Получить уведомления пользователя
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user?.userId
    const limit = parseInt(req.query.limit) || 50
    const unreadOnly = req.query.unread === 'true'

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const notifications = await Notification.getUserNotifications(userId, limit, unreadOnly)
    const unreadCount = await Notification.getUnreadCount(userId)

    res.json({ notifications, unreadCount })
  } catch (error) {
    console.error('Get notifications error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * POST /api/notifications/:id/read
 * Отметить уведомление как прочитанное
 */
router.post('/:id/read', async (req, res) => {
  try {
    const userId = req.user?.userId
    const { id } = req.params

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    await Notification.markAsRead(id, userId)
    res.json({ success: true })
  } catch (error) {
    console.error('Mark notification read error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * POST /api/notifications/read-all
 * Отметить все уведомления как прочитанные
 */
router.post('/read-all', async (req, res) => {
  try {
    const userId = req.user?.userId

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    await Notification.markAllAsRead(userId)
    res.json({ success: true })
  } catch (error) {
    console.error('Mark all notifications read error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
