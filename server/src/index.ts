import cors from 'cors'
import express from 'express'
import { config } from './config/env'
import { connectDB } from './config/db'
import { requestLogger } from './middleware/requestLogger'
import { errorHandler } from './middleware/errorHandler'
import catalogRoutes from './routes/catalog.routes'

const app = express()

app.use(cors({ origin: config.clientUrl }))
app.use(express.json())
app.use(requestLogger)

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'agentic-catalog-server',
    timestamp: new Date().toISOString(),
  })
})

app.use('/api/catalog', catalogRoutes)

// Routes get mounted here starting Phase 2:
// app.use('/api/checkout', checkoutRoutes)
// app.use('/api/webhooks/razorpay', webhookRoutes)
// app.use('/api/audit', auditRoutes)

app.use(errorHandler)

async function start(): Promise<void> {
  await connectDB()
  app.listen(config.port, () => {
    console.log(`[server] Listening on http://localhost:${config.port}`)
  })
}

start()
