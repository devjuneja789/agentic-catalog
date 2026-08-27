import cors from 'cors'
import express from 'express'
import { config } from './config/env'
import { connectDB } from './config/db'
import { requestLogger } from './middleware/requestLogger'
import { errorHandler } from './middleware/errorHandler'
import catalogRoutes from './routes/catalog.routes'
import checkoutRoutes from './routes/checkout.routes'
import webhookRoutes from './routes/webhook.routes'
import './types' // pulls in the Express.Request.rawBody augmentation

const app = express()

app.use(cors({ origin: config.clientUrl }))
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

// Mounted here starting Phase 3:
// app.use('/api/audit', auditRoutes)

app.use(errorHandler)

async function start(): Promise<void> {
  await connectDB()
  app.listen(config.port, '0.0.0.0', () => {
    console.log(`[server] Listening on http://localhost:${config.port}`)
  })
}

start()
