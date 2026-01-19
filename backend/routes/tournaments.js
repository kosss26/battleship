import express from 'express'
import Tournament from '../models/Tournament.js'

const router = express.Router()

/**
 * GET /api/tournaments
 * Список активных турниров
 */
router.get('/', async (req, res) => {
  try {
    const tournaments = await Tournament.getActive()
    res.json({ tournaments })
  } catch (error) {
    console.error('Get tournaments error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * GET /api/tournaments/:id
 * Информация о турнире
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const tournament = await Tournament.findById(id)
    
    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' })
    }

    const leaderboard = await Tournament.getLeaderboard(id, 100)
    
    res.json({ tournament, leaderboard })
  } catch (error) {
    console.error('Get tournament error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * POST /api/tournaments/:id/join
 * Регистрация на турнир
 */
router.post('/:id/join', async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user?.userId

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const result = await Tournament.join(id, userId)
    
    if (!result.success) {
      return res.status(400).json({ error: result.error })
    }

    res.json(result)
  } catch (error) {
    console.error('Join tournament error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * GET /api/tournaments/:id/leaderboard
 * Таблица лидеров турнира
 */
router.get('/:id/leaderboard', async (req, res) => {
  try {
    const { id } = req.params
    const limit = parseInt(req.query.limit) || 100
    
    const leaderboard = await Tournament.getLeaderboard(id, limit)
    res.json({ leaderboard })
  } catch (error) {
    console.error('Get tournament leaderboard error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * GET /api/tournaments/user/history
 * История турниров пользователя
 */
router.get('/user/history', async (req, res) => {
  try {
    const userId = req.user?.userId

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const tournaments = await Tournament.getUserTournaments(userId)
    res.json({ tournaments })
  } catch (error) {
    console.error('Get user tournaments error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
