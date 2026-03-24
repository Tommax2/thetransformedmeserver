import rateLimit from 'express-rate-limit';

const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);

const buildRateLimiter = ({
	windowMs = RATE_LIMIT_WINDOW_MS,
	max,
	message,
	skipSuccessfulRequests = false,
}) =>
	rateLimit({
		windowMs,
		max,
		standardHeaders: true,
		legacyHeaders: false,
		skipSuccessfulRequests,
		message: { message },
	});

export const authRateLimiter = buildRateLimiter({
	max: Number(process.env.AUTH_RATE_LIMIT_MAX || 10),
	message: 'Too many authentication attempts. Please try again later.',
	skipSuccessfulRequests: true,
});

export const refreshRateLimiter = buildRateLimiter({
	max: Number(process.env.REFRESH_RATE_LIMIT_MAX || 30),
	message: 'Too many token refresh attempts. Please try again later.',
});

export const checkoutRateLimiter = buildRateLimiter({
	max: Number(process.env.CHECKOUT_RATE_LIMIT_MAX || 20),
	message: 'Too many checkout requests. Please try again later.',
});

export const webhookRateLimiter = buildRateLimiter({
	max: Number(process.env.WEBHOOK_RATE_LIMIT_MAX || 300),
	message: 'Too many webhook requests. Please try again later.',
});
