import express from 'express'
import User from '../models/User.js'

const router = express.Router()

/**
 * GET /api/leaderboards/global
 * Глобальный рейтинг (топ-100 игроков)
 */
router.get('/global', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100
    const offset = parseInt(req.query.offset) || 0

    try {
      const players = await User.getLeaderboard(limit, offset)
      
      // Получаем статистику для каждого игрока
      const leaderboard = await Promise.all(
        players.map(async (player, index) => {
          const stats = await User.getStats(player.id)
          return {
            rank: offset + index + 1,
            id: player.id,
            username: player.username || player.first_name,
            avatar_url: player.avatar_url,
            rating: player.rating,
            level: player.level,
            winRate: stats.winRate,
            totalMatches: stats.totalMatches,
          }
        })
      )

      res.json({ leaderboard, total: leaderboard.length })
    } catch (dbError) {
      console.error('Database error:', dbError)
      // Fallback на мок-данные
      const mockLeaderboard = Array.from({ length: Math.min(limit, 20) }, (_, i) => ({
        rank: offset + i + 1,
        username: `Player${i + 1}`,
        rating: 2000 - i * 50,
        winRate: 85 - i * 2,
      }))
      res.json({ leaderboard: mockLeaderboard, total: 100 })
    }
  } catch (error) {
    console.error('Get global leaderboard error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * GET /api/leaderboards/user-rank
 * Получить рейтинг текущего пользователя
 */
router.get('/user-rank', async (req, res) => {
  try {
    const userId = req.user?.userId

    if (!userId) {
      return res.json({ rank: null })
    }

    const rank = await User.getRank(userId)
    const user = await User.findById(userId)
    const stats = await User.getStats(userId)

    res.json({
      rank,
      rating: user?.rating || 1000,
      stats,
    })
  } catch (error) {
    console.error('Get user rank error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * GET /api/leaderboards/weekly
 * Еженедельный рейтинг
 */
router.get('/weekly', async (req, res) => {
  try {
    // TODO: Реализовать еженедельный рейтинг на основе побед за неделю
    res.json({ leaderboard: [], total: 0 })
  } catch (error) {
    console.error('Get weekly leaderboard error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
