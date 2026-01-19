import express from 'express'
import User from '../models/User.js'
import Achievement from '../models/Achievement.js'

const router = express.Router()

/**
 * GET /api/users/:id
 * Получить профиль пользователя
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params

    const user = await User.findById(id)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const stats = await User.getStats(id)
    const rank = await User.getRank(id)

    res.json({
      user: {
        id: user.id,
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name,
        avatar_url: user.avatar_url,
        rating: user.rating,
        level: user.level,
        stats,
        rank,
      },
    })
  } catch (error) {
    console.error('Get user error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * GET /api/users/:id/stats
 * Получить статистику пользователя
 */
router.get('/:id/stats', async (req, res) => {
  try {
    const { id } = req.params

    const stats = await User.getStats(id)
    res.json({ stats })
  } catch (error) {
    console.error('Get user stats error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * GET /api/users/:id/achievements
 * Получить достижения пользователя
 */
router.get('/:id/achievements', async (req, res) => {
  try {
    const { id } = req.params

    const userAchievements = await Achievement.getUserAchievements(id)
    const allAchievements = Achievement.getAll()

    // Объединяем с информацией о разблокировке
    const achievements = allAchievements.map(achievement => {
      const unlocked = userAchievements.find(ua => ua.name === achievement.name)
      return {
        ...achievement,
        unlocked: !!unlocked,
        unlockedAt: unlocked?.unlocked_at,
      }
    })

    res.json({ achievements })
  } catch (error) {
    console.error('Get achievements error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * PUT /api/users/:id
 * Обновить профиль пользователя
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user?.userId

    // Можно обновлять только свой профиль
    if (userId !== id) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    const { username, firstName, lastName } = req.body

    const user = await User.update(id, {
      username,
      firstName,
      lastName,
    })

    res.json({ user })
  } catch (error) {
    console.error('Update user error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
