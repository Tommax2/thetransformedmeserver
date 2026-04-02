import express from 'express';
import {
	createStripeCheckoutSession,
	getStripeSession,
	createPaystackCheckoutSession,
	verifyPaystackPayment,
	resendPaymentConfirmationEmail,
} from '../controllers/payment.controller.js';
import { protectRoute } from '../middleware/auth.middle.js';
import { checkoutRateLimiter } from '../middleware/rateLimit.js';

const router = express.Router();

// Primary Stripe routes used by the frontend.
router.post(
	'/stripe/checkout-session',
	protectRoute,
	checkoutRateLimiter,
	createStripeCheckoutSession
);
router.get('/stripe/session', protectRoute, getStripeSession);

// Paystack routes
router.post(
	'/paystack/checkout-session',
	protectRoute,
	checkoutRateLimiter,
	createPaystackCheckoutSession
);
router.get('/paystack/verify', protectRoute, verifyPaystackPayment);

// Resend confirmation email
router.post('/resend-confirmation/:orderId', protectRoute, resendPaymentConfirmationEmail);

// Webhook health check (for monitoring)
router.get('/webhook-health', (req, res) => {
	res.status(200).json({
		status: 'healthy',
		timestamp: new Date().toISOString(),
		webhooks: ['stripe', 'paystack']
	});
});

// Backwards-compatible aliases.
router.post('/checkout', protectRoute, checkoutRateLimiter, createStripeCheckoutSession);
router.get('/session', protectRoute, getStripeSession);

export default router;
