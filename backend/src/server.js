import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { config } from './config.js'
import { migrate } from './db.js'
import api from './routes/api.js'
import { initSockets, isOnline } from './game/manager.js'
import { startReminderScheduler } from './services/notify.js'
import { startSeasonScheduler } from './services/seasons.js'
import { setupBot } from './services/bot.js'

const corsOrigin = (origin, cb) => {
  // Telegram WebView and server-to-server requests may come without Origin
  if (!origin || config.frontendOrigins.includes('*') || config.frontendOrigins.includes(origin)) return cb(null, true)
  cb(null, false)
}

export async function start() {
  await migrate()
  const app = express()
  app.set('trust proxy', 1)
  app.use(helmet({ crossOriginResourcePolicy: false }))
  app.use(cors({ origin: corsOrigin }))
  app.use(express.json({ limit: '64kb' }))
  app.use('/api', api)
  app.use((req, res) => res.status(404).json({ error: 'not_found' }))

  const httpServer = createServer(app)
  const io = new Server(httpServer, { cors: { origin: corsOrigin }, pingInterval: 10000, pingTimeout: 8000 })
  initSockets(io)

  await new Promise((resolve) => httpServer.listen(config.port, resolve))
  console.log(`⚓ Battleship API listening on :${config.port}`)
  setupBot()
  if (process.env.NODE_ENV !== 'test') {
    startReminderScheduler(isOnline)
    startSeasonScheduler()
  }
  return { app, httpServer, io }
}

