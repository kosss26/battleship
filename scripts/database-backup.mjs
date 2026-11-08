import { spawn } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { mkdir, rename, chmod, unlink, stat } from 'node:fs/promises'
import crypto from 'node:crypto'
import pg from 'pg'

const [mode, destination] = process.argv.slice(2)
if (!['backup', 'verify'].includes(mode) || !destination || !process.env.DATABASE_URL) {
  console.error('Usage: DATABASE_URL=… node scripts/database-backup.mjs backup|verify /path/to/archive.dump')
  process.exit(1)
}
const file = resolve(destination)
process.umask(0o077)
async function run(command, args, database = process.env.DATABASE_URL) {
  const url = new URL(database)
  const connection = { PGHOST: url.hostname, PGPORT: url.port || '5432',
    PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: decodeURIComponent(url.pathname.slice(1)) }
  for (const [param, name] of Object.entries({ sslmode: 'PGSSLMODE', sslrootcert: 'PGSSLROOTCERT', options: 'PGOPTIONS' })) {
    if (url.searchParams.has(param)) connection[name] = url.searchParams.get(param)
  }
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { env: { ...process.env, ...connection }, stdio: ['ignore','ignore','pipe'] })
    let error = ''
    child.stderr.on('data', chunk => { error = (error + chunk).slice(-4000) })
    child.on('error', reject)
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`${command} failed (${code}): ${error}`)))
  })
}
if (mode === 'backup') {
  await mkdir(dirname(file), { recursive: true, mode: 0o700 })
  const temporary = `${file}.${crypto.randomUUID()}.tmp`
  try {
    await run('pg_dump', ['--format=custom', '--no-owner', '--no-acl', '--file', temporary])
    await chmod(temporary, 0o600)
    await run('pg_restore', ['--list', temporary])
    await rename(temporary, file)
    console.log(`Backup saved: ${file} (${(await stat(file)).size} bytes)`)
  } finally { await unlink(temporary).catch(() => {}) }
} else {
  // Always create an isolated empty database; never overwrite a supplied target.
  const scratch = `battleship_restore_${crypto.randomBytes(8).toString('hex')}`
  const admin = new pg.Client({ connectionString: process.env.DATABASE_URL })
  await admin.connect()
  try {
    await admin.query(`CREATE DATABASE "${scratch}" TEMPLATE template0`)
    const url = new URL(process.env.DATABASE_URL); url.pathname = `/${scratch}`
    try {
      await run('pg_restore', ['--exit-on-error', '--single-transaction', '--no-owner', '--no-acl', '--dbname', scratch, file], url.href)
      const check = new pg.Client({ connectionString: url.href })
      await check.connect()
      try {
        const { rows } = await check.query(`SELECT
          (SELECT count(*)::int FROM users) AS users,
          (SELECT count(*)::int FROM games) AS games,
          (SELECT count(*)::int FROM payments) AS payments,
          (SELECT count(*)::int FROM star_invoices) AS invoices,
          (SELECT count(*)::int FROM payment_refund_notices) AS refund_notices,
          (SELECT count(*)::int FROM game_rooms WHERE settlement IS NULL) AS recoverable_rooms`)
        console.log(`Restore verified in isolated database: ${JSON.stringify(rows[0])}`)
      } finally { await check.end() }
    } finally { await admin.query(`DROP DATABASE "${scratch}" WITH (FORCE)`) }
  } finally { await admin.end() }
}
