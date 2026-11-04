import express from 'express'
import {
  requireAdmin, dashboard, searchUsers, userDetail, setBan, adjustUser, listPayments, refund,
  adminLog, broadcast, broadcastJobs,
} from '../services/admin.js'
import { analytics } from '../services/analytics.js'
import { GameError } from '../services/users.js'

/** Every route here re-checks that the caller's Telegram id is listed in ADMIN_IDS */
export default function adminRouter({ auth, wrap }) {
  const router = express.Router()

  router.use(auth, async (req, res, next) => {
    try {
      req.admin = await requireAdmin(req.userId)
      next()
    } catch (e) {
      res.status(e instanceof GameError ? e.status : 500).json({ error: e.code || 'server_error' })
    }
  })

  router.get('/dashboard', wrap(async (req, res) => res.json(await dashboard())))
  router.get('/analytics', wrap(async (req, res) => res.json(await analytics(Number(req.query.days) || 30))))
  router.get('/users', wrap(async (req, res) => res.json({ users: await searchUsers(req.query.q) })))
  router.get('/users/:id', wrap(async (req, res) => res.json(await userDetail(Number(req.params.id)))))
  router.post('/users/:id/ban', wrap(async (req, res) => {
    await setBan(req.admin, Number(req.params.id), !!req.body?.banned, req.body?.reason)
    res.json(await userDetail(Number(req.params.id)))
  }))
  router.post('/users/:id/adjust', wrap(async (req, res) => {
    const applied = await adjustUser(req.admin, Number(req.params.id), req.body?.changes, req.body?.reason)
    res.json({ applied, ...(await userDetail(Number(req.params.id))) })
  }))
  router.get('/payments', wrap(async (req, res) => res.json({ payments: await listPayments(req.query.status) })))
  router.post('/payments/:id/refund', wrap(async (req, res) => {
    res.json({ revoked: await refund(req.admin, Number(req.params.id), req.body?.reason) })
  }))
  router.get('/log', wrap(async (req, res) => res.json({ log: await adminLog() })))
  router.get('/broadcast', wrap(async (req, res) => res.json({ jobs: broadcastJobs() })))
  router.post('/broadcast', wrap(async (req, res) => res.json(await broadcast(req.admin, req.body || {}))))

  return router
}
