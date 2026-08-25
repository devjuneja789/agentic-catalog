import { Router } from 'express'
import { getProductById, listCatalog, searchCatalog } from '../controllers/catalog.controller'

const router = Router()

router.get('/search', searchCatalog)
router.get('/:id', getProductById)
router.get('/', listCatalog)

export default router
