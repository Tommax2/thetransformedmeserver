import express from 'express';
import { createStripeCheckoutSession } from '../controllers/payment.controller.js';
import { protectRoute } from '../middleware/auth.middle.js';
import { getStripeSession } from '../controllers/payment.controller.js';



const router = express.Router();

router.post('/stripe/checkout-session', protectRoute, createStripeCheckoutSession);

router.get('/stripe/session', protect, getStripeSession);

export default router;
