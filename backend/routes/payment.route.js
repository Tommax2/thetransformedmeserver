import express from 'express';
import { checkout } from '../controllers/payment.controller.js';
import { protectRoute } from '../middleware/auth.middle.js';

const router = express.Router();

router.post('/checkout', protectRoute, checkout);

export default router;