import express from 'express'
import BattlePass from '../models/BattlePass.js'

const router = express.Router()

/**
 * GET /api/battlepass
 * Получить текущий Battle Pass и прогресс
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user?.userId
    
    const battlePass = await BattlePass.getCurrent()
    
    let progress = null
    if (userId) {
      progress = await BattlePass.getUserProgress(userId)
    }
    
    res.json({ battlePass, progress })
  } catch (error) {
    console.error('Get battle pass error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * POST /api/battlepass/buy-premium
 * Купить премиум Battle Pass
 */
router.post('/buy-premium', async (req, res) => {
  try {
    const userId = req.user?.userId
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const result = await BattlePass.buyPremium(userId)
    
    if (!result.success) {
      return res.status(400).json({ error: result.error })
    }

    res.json(result)
  } catch (error) {
    console.error('Buy premium error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * POST /api/battlepass/claim
 * Забрать награду
 */
router.post('/claim', async (req, res) => {
  try {
    const userId = req.user?.userId
    const { level, isPremium } = req.body
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    if (!level) {
      return res.status(400).json({ error: 'Level required' })
    }

    const result = await BattlePass.claimReward(userId, level, isPremium)
    
    if (!result.success) {
      return res.status(400).json({ error: result.error })
    }

    res.json(result)
  } catch (error) {
    console.error('Claim reward error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
