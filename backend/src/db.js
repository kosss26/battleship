import pg from 'pg'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { config } from './config.js'

const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseSsl ? { rejectUnauthorized: false } : false,
  max: 15,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  statement_timeout: 8000,
  idle_in_transaction_session_timeout: 15000,
})

pool.on('error', (err) => console.error('[db] idle client error', err.message))

export const query = (text, params) => pool.query(text, params)

export async function tx(fn) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }
}

export async function migrate() {
  const dir = dirname(fileURLToPath(import.meta.url))
  await pool.query(readFileSync(join(dir, 'schema.sql'), 'utf8'))
}

let releaseLease = null
export const closeDb = async () => { await releaseLease?.(); await pool.end() }

// One authoritative room owner per database. A second backend must not restore
// the same fleets and independently run their timers.
export async function acquireGameLease() {
  const client = new pg.Client({ connectionString: config.databaseUrl, connectionTimeoutMillis: 5000,
    ssl: config.databaseSsl ? { rejectUnauthorized: false } : false })
  await client.connect()
  const { rows } = await client.query('SELECT pg_try_advisory_lock(8152027) AS ok')
  if (!rows[0].ok) { await client.end(); throw new Error('Another game server owns this database') }
  const lost = () => { console.error('[game-lease] connection lost; stopping authority'); process.exit(1) }
  client.on('error', lost)
  let released = false
  releaseLease = async () => {
    if (released) return
    released = true
    client.off('error', lost)
    await client.end()
  }
  return releaseLease
}
