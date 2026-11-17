import { app } from './app.js'
import { connectDatabase, disconnectDatabase } from './config/db.js'
import { env } from './config/env.js'

let server

async function start() {
  await connectDatabase()
  server = app.listen(env.PORT, () => console.info(`Learnly API listening on http://localhost:${env.PORT}`))
}

async function shutdown(signal) {
  console.info(`${signal} received; shutting down gracefully.`)
  if (server) await new Promise((resolve) => server.close(resolve))
  await disconnectDatabase()
  process.exit(0)
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

start().catch((error) => {
  console.error('Unable to start the API:', error)
  process.exit(1)
})
