import express from 'express';
import { createStripeCheckoutSession } from '../controllers/payment.controller.js';
import { protectRoute } from '../middleware/auth.middle.js';

const router = express.Router();

router.post('/stripe/checkout-session', protectRoute, createStripeCheckoutSession);

export default router;
