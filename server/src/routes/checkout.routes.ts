import { Router } from 'express'
import {
  createCheckout,
  getOrderEndpoint,
  getPendingOrdersEndpoint,
  approveOrderEndpoint,
  denyOrderEndpoint,
  verifyOrderPaymentEndpoint,
  cancelOrderEndpoint,
} from '../controllers/checkout.controller'

const router = Router()

// Literal route for pending approvals queue must come before /:orderId
router.get('/pending', getPendingOrdersEndpoint)

router.post('/:productId', createCheckout)
router.post('/:orderId/approve', approveOrderEndpoint)
router.post('/:orderId/deny', denyOrderEndpoint)
router.post('/:orderId/verify', verifyOrderPaymentEndpoint)
router.post('/:orderId/capture', verifyOrderPaymentEndpoint)
router.post('/:orderId/cancel', cancelOrderEndpoint)
router.get('/:orderId', getOrderEndpoint)

export default router
