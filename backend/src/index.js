import { start } from './server.js'

start().catch((e) => {
  console.error(e)
  process.exit(1)
})
