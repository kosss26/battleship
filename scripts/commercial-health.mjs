import pg from 'pg'
import { stat } from 'node:fs/promises'

if (!process.env.DATABASE_URL || !process.env.BATTLESHIP_READY_URL) {
  console.error('Set DATABASE_URL and BATTLESHIP_READY_URL; optionally BATTLESHIP_BACKUP_FILE.')
  process.exit(1)
}
const client = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000, statement_timeout: 5000 })
try {
  const ready = await fetch(process.env.BATTLESHIP_READY_URL, { signal: AbortSignal.timeout(6000) }).then(r => r.ok).catch(() => false)
  await client.connect()
  const { rows } = await client.query(`SELECT
    (SELECT count(*)::int FROM game_rooms WHERE settlement IS NULL AND state->>'phase'='over'
      AND updated_at < now()-interval '1 minute') AS stuck_results,
    (SELECT count(*)::int FROM payments WHERE status='refund_pending'
      AND COALESCE(refund_requested_at,created_at) < now()-interval '15 minutes') AS stuck_refunds`)
  const backupAgeHours = process.env.BATTLESHIP_BACKUP_FILE
    ? (Date.now() - (await stat(process.env.BATTLESHIP_BACKUP_FILE)).mtimeMs) / 3600000 : null
  const status = { ready, ...rows[0], backupAgeHours: backupAgeHours == null ? null : +backupAgeHours.toFixed(1) }
  console.log(JSON.stringify(status))
  if (!ready || status.stuck_results || status.stuck_refunds || (backupAgeHours != null && backupAgeHours > 26)) process.exitCode = 1
} catch (e) { console.error('Health check failed:', e.message); process.exitCode = 1 }
finally { await client.end().catch(() => {}) }
