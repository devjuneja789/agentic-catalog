import { Router } from 'express'
import { getProductById, listCatalog, searchCatalog, updateProduct } from '../controllers/catalog.controller'

const router = Router()

router.get('/search', searchCatalog)
router.get('/:id', getProductById)
router.patch('/:id', updateProduct)
router.get('/', listCatalog)

export default router
