import express from 'express';
import { 
    createProducts, 
    deleteProducts,
    getRecommendedProducts,
    getProductsByCategory,
    getProductById,
    getAllProducts,
    toggleFeaturedProduct,
    getFeaturedProducts } from '../controllers/product.controller.js';
import { protectRoute, adminRoute} from '../middleware/auth.middle.js';
const router = express.Router();

router.get('/', protectRoute, adminRoute, getAllProducts);
router.get('/featured', getFeaturedProducts);
router.get('/category/:category', getProductsByCategory);
router.get('/recommendations', getRecommendedProducts);
router.get('/:id', getProductById);
router.post('/', protectRoute, adminRoute, createProducts);
router.patch('/:id', protectRoute, adminRoute, toggleFeaturedProduct);
router.delete('/:id', protectRoute, adminRoute, deleteProducts);
export default router;
