import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import { createServer } from 'http'
import { Server } from 'socket.io'
import dotenv from 'dotenv'

// Routes
import authRoutes from './routes/auth.js'
import gameRoutes from './routes/games.js'
import leaderboardRoutes from './routes/leaderboards.js'
import userRoutes from './routes/users.js'
import referralRoutes from './routes/referrals.js'
import challengeRoutes from './routes/challenges.js'
import tournamentRoutes from './routes/tournaments.js'
import battlepassRoutes from './routes/battlepass.js'
import paymentRoutes from './routes/payments.js'
import notificationRoutes from './routes/notifications.js'

// Middleware
import { authenticateToken, optionalAuth } from './middleware/auth.js'

// WebSocket
import { initGameSocket } from './socket/gameSocket.js'

// Загрузка переменных окружения
dotenv.config()

const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
})

const PORT = process.env.PORT || 5000

// Middleware
app.use(helmet())
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}))
app.use(morgan('dev'))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Battleship API is running', version: '1.0.0' })
})

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/games', authenticateToken, gameRoutes)
app.use('/api/leaderboards', optionalAuth, leaderboardRoutes)
app.use('/api/users', optionalAuth, userRoutes)
app.use('/api/referrals', authenticateToken, referralRoutes)
app.use('/api/challenges', authenticateToken, challengeRoutes)
app.use('/api/tournaments', optionalAuth, tournamentRoutes)
app.use('/api/battlepass', optionalAuth, battlepassRoutes)
app.use('/api/payments', optionalAuth, paymentRoutes)
app.use('/api/notifications', authenticateToken, notificationRoutes)

// Инициализация WebSocket событий для PvP
initGameSocket(io)

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' })
})

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ error: 'Something went wrong!' })
})

// Start server
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
  console.log(`📡 Socket.io server ready for PvP`)
  console.log(`🎮 Battleship API v1.0.0`)
})

export { io }
