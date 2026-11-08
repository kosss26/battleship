import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { config } from './config.js'
import { migrate, query, acquireGameLease } from './db.js'
import api from './routes/api.js'
import { initSockets, isOnline, restoreGames, stopGames } from './game/manager.js'
import { startReminderScheduler } from './services/notify.js'
import { startSeasonScheduler } from './services/seasons.js'
import { setupBot } from './services/bot.js'
import { startRefundScheduler } from './services/refunds.js'
import { deliverMatchNotifications } from './services/match.js'

const corsOrigin = (origin, cb) => {
  // Telegram WebView and server-to-server requests may come without Origin
  if (!origin || config.frontendOrigins.includes('*') || config.frontendOrigins.includes(origin)) return cb(null, true)
  cb(null, false)
}

export async function start() {
  await migrate()
  const releaseLease = await acquireGameLease()
  try { await restoreGames() } catch (e) { await releaseLease(); throw e }
  const app = express()
  app.set('trust proxy', 1)
  app.use(helmet({ crossOriginResourcePolicy: false }))
  app.use(cors({ origin: corsOrigin }))
  app.use(express.json({ limit: '64kb' }))
  let stopping = false
  app.get('/api/ready', async (_req, res) => {
    try {
      if (stopping) return res.status(503).json({ ok: false })
      await query('SELECT 1')
      res.json({ ok: true })
    } catch { res.status(503).json({ ok: false }) }
  })
  app.use('/api', api)
  app.use((req, res) => res.status(404).json({ error: 'not_found' }))

  const httpServer = createServer(app)
  const io = new Server(httpServer, { cors: { origin: corsOrigin }, pingInterval: 10000, pingTimeout: 8000 })
  initSockets(io)

  await new Promise((resolve) => httpServer.listen(config.port, resolve))
  console.log(`⚓ Battleship API listening on :${config.port}`)
  setupBot()
  const stopRefunds = process.env.NODE_ENV !== 'test' ? startRefundScheduler() : async () => {}
  const notificationTimer = process.env.NODE_ENV !== 'test' ? setInterval(() => {
    deliverMatchNotifications().catch(e => console.error('[match-notify]', e.message))
  }, 30_000).unref() : null
  if (process.env.NODE_ENV !== 'test') {
    startReminderScheduler(isOnline)
    startSeasonScheduler()
  }
  const stop = async () => {
    if (stopping) return
    stopping = true
    clearInterval(notificationTimer)
    await stopGames()
    await stopRefunds()
    await new Promise(resolve => io.close(resolve))
    await releaseLease()
  }
  return { app, httpServer, io, stop }
}

