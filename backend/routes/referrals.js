import express from 'express'
import Referral from '../models/Referral.js'

const router = express.Router()

/**
 * GET /api/referrals/code
 * Получить свой реферальный код
 */
router.get('/code', async (req, res) => {
  try {
    const userId = req.user?.userId
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const code = await Referral.generateCode(userId)
    const stats = await Referral.getStats(userId)
    
    res.json({ code, stats })
  } catch (error) {
    console.error('Get referral code error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * POST /api/referrals/apply
 * Применить реферальный код
 */
router.post('/apply', async (req, res) => {
  try {
    const userId = req.user?.userId
    const { code } = req.body
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    if (!code) {
      return res.status(400).json({ error: 'Code required' })
    }

    const result = await Referral.applyCode(userId, code.toUpperCase())
    
    if (!result.success) {
      return res.status(400).json({ error: result.error })
    }

    res.json(result)
  } catch (error) {
    console.error('Apply referral code error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * GET /api/referrals/list
 * Список приглашённых игроков
 */
router.get('/list', async (req, res) => {
  try {
    const userId = req.user?.userId
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const referrals = await Referral.getReferrals(userId)
    const stats = await Referral.getStats(userId)
    
    res.json({ referrals, stats })
  } catch (error) {
    console.error('Get referrals error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
