import { Router } from 'express'
import { handleRazorpayWebhook } from '../controllers/checkout.controller'

const router = Router()

router.post('/', handleRazorpayWebhook)

export default router
