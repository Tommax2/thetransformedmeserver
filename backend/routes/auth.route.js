
import express from 'express';
import {
	signup,
	login,
	logout,
	refreshToken,
	getProfile,
} from '../controllers/auth.controller.js';
import { protectRoute } from '../middleware/auth.middle.js';
import {
	authRateLimiter,
	refreshRateLimiter,
} from '../middleware/rateLimit.js';

const router = express.Router();

router.post('/signup', authRateLimiter, signup);
router.post('/login', authRateLimiter, login);
router.post('/logout', protectRoute, logout);
router.post('/refresh-token', refreshRateLimiter, refreshToken);
router.get('/profile', protectRoute, getProfile);

export default router;
