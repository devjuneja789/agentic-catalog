import cors from 'cors'
import express from 'express'
import { config } from './config/env'
import { connectDB } from './config/db'
import { requestLogger } from './middleware/requestLogger'
import { errorHandler } from './middleware/errorHandler'
import catalogRoutes from './routes/catalog.routes'
import checkoutRoutes from './routes/checkout.routes'
import webhookRoutes from './routes/webhook.routes'
import auditRoutes from './routes/audit.routes'
import agentRoutes from './routes/agent.routes'
import mcpRoutes from './routes/mcp.routes'
import './types' // pulls in the Express.Request.rawBody augmentation

const app = express()

const allowedOrigins = config.clientUrl
  ? config.clientUrl.split(',').map((u) => u.trim().replace(/\/$/, ''))
  : ['http://localhost:5173']

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (curl, MCP runners, mobile apps)
      if (!origin) return callback(null, true)
      const cleanOrigin = origin.replace(/\/$/, '')
      if (allowedOrigins.includes(cleanOrigin) || allowedOrigins.includes('*') || config.nodeEnv === 'development') {
        return callback(null, true)
      }
      return callback(null, true)
    },
    credentials: true,
  }),
)
app.use(
  express.json({
    // Stash the raw body string alongside the parsed JSON — Razorpay's
    // webhook signature must be computed over the exact bytes they sent.
    verify: (req, _res, buf) => {
      ;(req as express.Request).rawBody = buf.toString('utf8')
    },
  }),
)
app.use(requestLogger)

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'agentic-catalog-server',
    timestamp: new Date().toISOString(),
  })
})

app.use('/api/catalog', catalogRoutes)
app.use('/api/checkout', checkoutRoutes)
app.use('/api/webhooks/razorpay', webhookRoutes)
app.use('/api/audit', auditRoutes)
app.use('/api/agent', agentRoutes)
app.use('/api/mcp', mcpRoutes)

app.use(errorHandler)

async function start(): Promise<void> {
  await connectDB()
  app.listen(config.port, () => {
    console.log(`[server] Listening on http://localhost:${config.port}`)
  })
}

start()
