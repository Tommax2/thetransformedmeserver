import express from 'express';
import { addToCart,
            updateCartItem,
            getCartProducts,
            removeFromCart

} from '../controllers/cart.controller.js';
import { protectRoute } from '../middleware/auth.middle.js';

const router = express.Router();

router.get('/', protectRoute, getCartProducts);
router.post('/', protectRoute, addToCart);
router.delete('/', protectRoute, removeFromCart);
router.put('/:id', protectRoute, updateCartItem);

export default router;
