import { start } from './server.js'
import { closeDb } from './db.js'

start().then(server => {
  let closing = false
  const stop = async () => {
    if (closing) return
    closing = true
    const hardStop = setTimeout(() => process.exit(1), 20_000).unref()
    try { await server.stop(); await closeDb(); clearTimeout(hardStop); process.exit(0) }
    catch (e) { console.error('[shutdown]', e.message); process.exit(1) }
  }
  process.on('SIGTERM', stop)
  process.on('SIGINT', stop)
}).catch((e) => {
  console.error(e)
  process.exit(1)
})
