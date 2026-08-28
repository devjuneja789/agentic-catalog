import { Router } from 'express'
import { getAuditTrail } from '../controllers/audit.controller'

const router = Router()

router.get('/', getAuditTrail)

export default router
