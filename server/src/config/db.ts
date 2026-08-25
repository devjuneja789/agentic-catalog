import mongoose from 'mongoose'
import { config } from './env'

export async function connectDB(): Promise<void> {
  if (!config.mongodbUri) {
    console.warn('[db] No MONGODB_URI set — skipping DB connection. The API will still boot, but nothing that touches Mongo will work yet.')
    return
  }

  try {
    await mongoose.connect(config.mongodbUri)
    console.log('[db] Connected to MongoDB')
  } catch (err) {
    console.error('[db] Failed to connect to MongoDB:', err instanceof Error ? err.message : err)
    console.warn('[db] Continuing without a DB connection — check MONGODB_URI in server/.env')
  }
}
