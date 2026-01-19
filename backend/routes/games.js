import express from 'express'
import Game from '../models/Game.js'
import User from '../models/User.js'
import Achievement from '../models/Achievement.js'
import { calculateNewRatings } from '../utils/elo.js'

const router = express.Router()

/**
 * POST /api/games/start
 * Начать новый матч против AI
 */
router.post('/start', async (req, res) => {
  try {
    const { difficulty = 'easy', playerBoard } = req.body
    const userId = req.user?.userId

    if (!playerBoard) {
      return res.status(400).json({ error: 'Player board required' })
    }

    // Генерируем доску AI (на сервере для безопасности)
    const aiBoard = generateRandomBoard()

    // Определяем режим игры
    const mode = `ai_${difficulty}`

    // Сохраняем игру в БД (если есть userId)
    let game = null
    if (userId) {
      try {
        game = await Game.create({
          player1Id: userId,
          player2Id: null, // AI не имеет ID
          player1Board: playerBoard,
          player2Board: aiBoard,
          mode,
        })
      } catch (dbError) {
        console.error('Error saving game to DB:', dbError)
      }
    }

    const gameId = game?.id || `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    res.json({
      gameId,
      status: 'playing',
      difficulty,
      currentPlayer: 'player',
    })
  } catch (error) {
    console.error('Start game error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * POST /api/games/:gameId/finish
 * Завершить игру и начислить награды
 */
router.post('/:gameId/finish', async (req, res) => {
  try {
    const { gameId } = req.params
    const { winner, difficulty, stats } = req.body
    const userId = req.user?.userId

    if (!userId) {
      return res.json({ success: true, rewards: getOfflineRewards(winner, difficulty) })
    }

    // Определяем награды согласно ТЗ
    const rewards = calculateRewards(winner === 'player', difficulty)

    try {
      // Обновляем игру в БД
      await Game.finish(gameId, winner === 'player' ? userId : null, null, null)

      // Начисляем награды
      await User.addCurrency(userId, { gold: rewards.gold })
      await User.addExperience(userId, rewards.exp)

      // Проверяем достижения
      const unlockedAchievements = await Achievement.checkAfterGame(userId, {
        winner,
        difficulty,
        stats,
      })

      res.json({
        success: true,
        rewards,
        achievements: unlockedAchievements,
      })
    } catch (dbError) {
      console.error('Error finishing game in DB:', dbError)
      res.json({ success: true, rewards })
    }
  } catch (error) {
    console.error('Finish game error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * GET /api/games/history
 * История матчей пользователя
 */
router.get('/history', async (req, res) => {
  try {
    const userId = req.user?.userId
    const limit = parseInt(req.query.limit) || 20
    const offset = parseInt(req.query.offset) || 0

    if (!userId) {
      return res.json({ games: [] })
    }

    const games = await Game.getHistory(userId, limit, offset)
    res.json({ games })
  } catch (error) {
    console.error('Get history error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * GET /api/games/stats
 * Статистика игр против AI
 */
router.get('/stats', async (req, res) => {
  try {
    const userId = req.user?.userId

    if (!userId) {
      return res.json({ stats: {} })
    }

    const stats = await Game.getAIStats(userId)
    res.json({ stats })
  } catch (error) {
    console.error('Get stats error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * Рассчитывает награды согласно ТЗ
 */
function calculateRewards(isWinner, difficulty) {
  const baseRewards = {
    easy: { gold: 50, exp: 100 },
    medium: { gold: 100, exp: 200 },
    hard: { gold: 150, exp: 300 },
  }

  const base = baseRewards[difficulty] || baseRewards.easy

  if (isWinner) {
    return { gold: base.gold, exp: base.exp }
  } else {
    return { gold: Math.floor(base.gold * 0.2), exp: Math.floor(base.exp * 0.5) }
  }
}

function getOfflineRewards(winner, difficulty) {
  return calculateRewards(winner === 'player', difficulty)
}

/**
 * Генерация случайной доски (копия из frontend для серверной валидации)
 */
function generateRandomBoard() {
  const BOARD_SIZE = 10
  const SHIPS = [
    { size: 4, count: 1 },
    { size: 3, count: 2 },
    { size: 2, count: 3 },
    { size: 1, count: 4 },
  ]

  const board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(0))

  const canPlace = (row, col, size, orientation) => {
    if (orientation === 'horizontal' && col + size > BOARD_SIZE) return false
    if (orientation === 'vertical' && row + size > BOARD_SIZE) return false

    for (let i = 0; i < size; i++) {
      const r = orientation === 'vertical' ? row + i : row
      const c = orientation === 'horizontal' ? col + i : col

      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const checkR = r + dr
          const checkC = c + dc
          if (checkR >= 0 && checkR < BOARD_SIZE && checkC >= 0 && checkC < BOARD_SIZE) {
            if (board[checkR][checkC] === 1) return false
          }
        }
      }
    }
    return true
  }

  for (const ship of SHIPS) {
    for (let i = 0; i < ship.count; i++) {
      let placed = false
      let attempts = 0

      while (!placed && attempts < 1000) {
        const orientation = Math.random() > 0.5 ? 'horizontal' : 'vertical'
        const row = Math.floor(Math.random() * BOARD_SIZE)
        const col = Math.floor(Math.random() * BOARD_SIZE)

        if (canPlace(row, col, ship.size, orientation)) {
          for (let j = 0; j < ship.size; j++) {
            if (orientation === 'horizontal') {
              board[row][col + j] = 1
            } else {
              board[row + j][col] = 1
            }
          }
          placed = true
        }
        attempts++
      }
    }
  }

  return board
}

export default router
