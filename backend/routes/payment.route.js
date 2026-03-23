import express from 'express';
import { createStripeCheckoutSession, getStripeSession } from '../controllers/payment.controller.js';
import { protectRoute } from '../middleware/auth.middle.js';

const router = express.Router();

// Primary Stripe routes used by the frontend.
router.post('/stripe/checkout-session', protectRoute, createStripeCheckoutSession);
router.get('/stripe/session', protectRoute, getStripeSession);

// Backwards-compatible aliases.
router.post('/checkout', protectRoute, createStripeCheckoutSession);
router.get('/session', protectRoute, getStripeSession);

export default router;
