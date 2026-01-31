import 'express-async-errors'
import cors from 'cors'
import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import env from './config/env.js'
import { connectDatabase } from './database/connection.js'
import authRoutes from './routes/auth.js'
import articleRoutes from './routes/articles.js'
import topicRoutes from './routes/topics.js'
import uploadRoutes from './routes/uploads.js'
import adminRoutes from './routes/admin.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()

app.use(
  cors({
    origin: env.clientOrigin,
    credentials: true
  })
)
app.use(express.json({ limit: '2mb' }))

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')))

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' })
})

app.use('/api/auth', authRoutes)
app.use('/api/topics', topicRoutes)
app.use('/api/articles', articleRoutes)
app.use('/api/upload', uploadRoutes)
app.use('/api/admin', adminRoutes)

// Serve frontend static files (in production)
// In Docker, we copy frontend to dist/client, and server runs from dist/server
const clientDistPath = path.join(__dirname, '../client')
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath))
  // SPA catch-all
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'))
  })
}

app.use((_req, res) => {
  res.status(404).json({ message: 'Not found' })
})

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[server] unhandled error', err)
  res.status(500).json({ message: 'Internal server error' })
})

async function start() {
  await connectDatabase()
  app.listen(env.port, () => {
    console.info(`[server] listening on http://localhost:${env.port}`)
  })
}

if (import.meta.url === `file://${process.argv[1]}`) {
  start().catch(error => {
    console.error('[server] startup failure', error)
    process.exit(1)
  })
}

export default app
