import express from 'express'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import User from '../models/User.js'

const router = express.Router()

/**
 * POST /api/auth/telegram
 * Аутентификация через Telegram WebApp API
 */
router.post('/telegram', async (req, res) => {
  try {
    const { initData } = req.body

    if (!initData) {
      return res.status(400).json({ error: 'Telegram initData required' })
    }

    // Верификация Telegram WebApp данных
    const telegramUser = verifyTelegramWebAppData(initData)
    
    if (!telegramUser) {
      // В режиме разработки разрешаем без верификации
      if (process.env.NODE_ENV === 'development') {
        const parsedUser = parseTelegramInitData(initData)
        if (parsedUser) {
          return await handleUserAuth(parsedUser, res)
        }
      }
      return res.status(401).json({ error: 'Invalid Telegram data' })
    }

    return await handleUserAuth(telegramUser, res)
  } catch (error) {
    console.error('Auth error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * Обрабатывает аутентификацию пользователя
 */
async function handleUserAuth(telegramUser, res) {
  try {
    // Ищем пользователя в БД
    let user = await User.findByTelegramId(telegramUser.id)

    if (!user) {
      // Создаём нового пользователя
      user = await User.create({
        telegramId: telegramUser.id,
        username: telegramUser.username,
        firstName: telegramUser.first_name,
        lastName: telegramUser.last_name,
        avatarUrl: telegramUser.photo_url,
      })
    } else {
      // Обновляем данные пользователя
      user = await User.update(user.id, {
        username: telegramUser.username,
        firstName: telegramUser.first_name,
        lastName: telegramUser.last_name,
        avatarUrl: telegramUser.photo_url,
      })
    }

    // Получаем статистику
    const stats = await User.getStats(user.id)
    const rank = await User.getRank(user.id)

    // Генерируем JWT токен
    const token = jwt.sign(
      { userId: user.id, telegramId: user.telegram_id },
      process.env.JWT_SECRET || 'dev-secret-key',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    )

    res.json({
      token,
      user: {
        id: user.id,
        telegram_id: user.telegram_id,
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name,
        photo_url: user.avatar_url,
        rating: user.rating,
        level: user.level,
        gold: user.gold,
        gems: user.gems,
        stats,
        rank,
      },
    })
  } catch (dbError) {
    console.error('Database error during auth:', dbError)
    // Fallback на данные без БД
    const token = jwt.sign(
      { telegramId: telegramUser.id },
      process.env.JWT_SECRET || 'dev-secret-key',
      { expiresIn: '7d' }
    )

    res.json({
      token,
      user: {
        id: telegramUser.id,
        telegram_id: telegramUser.id,
        username: telegramUser.username,
        first_name: telegramUser.first_name,
        last_name: telegramUser.last_name,
        photo_url: telegramUser.photo_url,
        rating: 1000,
        level: 1,
        gold: 0,
        gems: 0,
      },
    })
  }
}

/**
 * Верифицирует данные Telegram WebApp
 */
function verifyTelegramWebAppData(initData) {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN
    if (!botToken) {
      console.warn('TELEGRAM_BOT_TOKEN not set, skipping verification')
      return null
    }

    const params = new URLSearchParams(initData)
    const hash = params.get('hash')
    params.delete('hash')

    // Сортируем параметры
    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n')

    // Вычисляем HMAC
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest()
    const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

    if (computedHash !== hash) {
      return null
    }

    const userStr = params.get('user')
    if (userStr) {
      return JSON.parse(decodeURIComponent(userStr))
    }

    return null
  } catch (error) {
    console.error('Telegram verification error:', error)
    return null
  }
}

/**
 * Парсинг initData без верификации (для разработки)
 */
function parseTelegramInitData(initData) {
  try {
    const params = new URLSearchParams(initData)
    const userStr = params.get('user')

    if (userStr) {
      return JSON.parse(decodeURIComponent(userStr))
    }

    return null
  } catch (error) {
    return null
  }
}

/**
 * POST /api/auth/logout
 */
router.post('/logout', (req, res) => {
  res.json({ message: 'Logged out successfully' })
})

/**
 * GET /api/auth/me
 * Получить текущего пользователя
 */
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers['authorization']
    const token = authHeader && authHeader.split(' ')[1]

    if (!token) {
      return res.status(401).json({ error: 'Token required' })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret-key')
    
    if (decoded.userId) {
      const user = await User.findById(decoded.userId)
      if (user) {
        const stats = await User.getStats(user.id)
        const rank = await User.getRank(user.id)
        
        return res.json({
          user: { ...user, stats, rank }
        })
      }
    }

    res.status(404).json({ error: 'User not found' })
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' })
  }
})

export default router
