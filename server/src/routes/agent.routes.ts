import { Router } from 'express'
import { runBuyerAgent } from '../controllers/agent.controller'

const router = Router()

router.post('/buy', runBuyerAgent)

export default router
