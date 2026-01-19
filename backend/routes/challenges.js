import express from 'express'
import DailyChallenge from '../models/DailyChallenge.js'

const router = express.Router()

/**
 * GET /api/challenges/daily
 * Получить ежедневные задания
 */
router.get('/daily', async (req, res) => {
  try {
    const userId = req.user?.userId
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const challenges = await DailyChallenge.getUserChallenges(userId)
    
    res.json({ challenges })
  } catch (error) {
    console.error('Get daily challenges error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * POST /api/challenges/claim
 * Забрать награды за выполненные задания
 */
router.post('/claim', async (req, res) => {
  try {
    const userId = req.user?.userId
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const result = await DailyChallenge.checkCompletion(userId)
    
    if (result.completedChallenges.length === 0) {
      return res.json({ 
        success: false, 
        message: 'Нет завершённых заданий для получения награды' 
      })
    }

    res.json({ 
      success: true,
      rewards: result.rewards,
      completedChallenges: result.completedChallenges,
    })
  } catch (error) {
    console.error('Claim rewards error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
