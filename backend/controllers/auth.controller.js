import User from '../models/user.model.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import redis from '../lib/redis.js';

const getCookieOptions = (maxAge) => {
	const isProduction = process.env.NODE_ENV === 'production';

	return {
		httpOnly: true,
		secure: isProduction,
		sameSite: isProduction ? 'None' : 'Lax',
		maxAge,
	};
};

const generateTokens = (userId) => {
	const accessToken = jwt.sign({ userId }, process.env.ACCESS_TOKEN_SECRET, {
		expiresIn: '15m',
	});

	const refreshToken = jwt.sign({ userId }, process.env.REFRESH_TOKEN_SECRET, {
		expiresIn: '7d',
	});

	return { accessToken, refreshToken };
};

const storeRefreshToken = async (userId, refreshToken) => {
	try {
		await redis.set(`refreshToken:${userId}`, refreshToken, {
			ex: 7 * 24 * 60 * 60,
		});
	} catch (error) {
		console.error('Failed to store refresh token in Redis:', error.message);
	}
};

const setCookie = (res, accessToken, refreshToken) => {
	res.cookie('accessToken', accessToken, getCookieOptions(15 * 60 * 1000));
	res.cookie(
		'refreshToken',
		refreshToken,
		getCookieOptions(7 * 24 * 60 * 60 * 1000)
	);
};

export const signup = async (req, res) => {
	const { name, email, password } = req.body || {};
	const normalizedEmail = email?.trim().toLowerCase();
	const trimmedName = name?.trim();

	if (!trimmedName || !normalizedEmail || !password) {
		return res.status(400).json({ message: 'All fields are required' });
	}

	if (trimmedName.length < 2) {
		return res
			.status(400)
			.json({ message: 'Name must be at least 2 characters long' });
	}

	if (password.length < 8) {
		return res
			.status(400)
			.json({ message: 'Password must be at least 8 characters long' });
	}

	try {
		const userExists = await User.findOne({ email: normalizedEmail });
		if (userExists) {
			return res.status(400).json({ message: 'User already exists' });
		}

		const user = await User.create({
			name: trimmedName,
			email: normalizedEmail,
			password,
		});

		const { accessToken, refreshToken } = generateTokens(user._id);
		await storeRefreshToken(user._id, refreshToken);
		setCookie(res, accessToken, refreshToken);

		return res.status(201).json({
			user: {
				id: user._id,
				name: user.name,
				email: user.email,
				roles: user.roles,
			},
			message: 'User registered successfully',
		});
	} catch (error) {
		console.log('Error in signup controller', error.message);
		return res.status(500).json({ message: 'Server error' });
	}
};

export const login = async (req, res) => {
	const { email, password } = req.body || {};

	if (!email || !password) {
		return res
			.status(400)
			.json({ message: 'Email and password are required' });
	}

	const normalizedEmail = email.trim().toLowerCase();

	try {
		const user = await User.findOne({ email: normalizedEmail });
		if (!user) {
			return res.status(400).json({ message: 'Invalid credentials' });
		}

		const isPasswordValid = await bcrypt.compare(password, user.password);
		if (!isPasswordValid) {
			return res.status(400).json({ message: 'Invalid credentials' });
		}

		const { accessToken, refreshToken } = generateTokens(user._id);
		await storeRefreshToken(user._id, refreshToken);
		setCookie(res, accessToken, refreshToken);

		return res.status(200).json({
			user: {
				id: user._id,
				name: user.name,
				email: user.email,
				roles: user.roles,
			},
			message: 'Login successful',
		});
	} catch (error) {
		console.log('Error in login controller', error.message);
		return res.status(500).json({ message: 'Server error' });
	}
};

export const logout = async (req, res) => {
	try {
		const refreshToken = req.cookies.refreshToken;

		if (refreshToken) {
			try {
				const decoded = jwt.verify(
					refreshToken,
					process.env.REFRESH_TOKEN_SECRET
				);
				await redis.del(`refreshToken:${decoded.userId}`);
			} catch (error) {
				console.error(
					'Failed to delete refresh token from Redis:',
					error.message
				);
			}
		}

		res.clearCookie('accessToken', getCookieOptions(0));
		res.clearCookie('refreshToken', getCookieOptions(0));

		return res.status(200).json({ message: 'Logout successful' });
	} catch (error) {
		return res.status(500).json({ message: 'Server error' });
	}
};

export const refreshToken = async (req, res) => {
	const refreshToken = req.cookies.refreshToken;

	if (!refreshToken) {
		return res.status(401).json({ message: 'No refresh token provided' });
	}

	try {
		const decoded = jwt.verify(
			refreshToken,
			process.env.REFRESH_TOKEN_SECRET
		);
		const storedToken = await redis.get(`refreshToken:${decoded.userId}`);

		if (storedToken !== refreshToken) {
			return res.status(403).json({ message: 'Refresh token does not match' });
		}

		const accessToken = jwt.sign(
			{ userId: decoded.userId },
			process.env.ACCESS_TOKEN_SECRET,
			{ expiresIn: '15m' }
		);

		res.cookie('accessToken', accessToken, getCookieOptions(15 * 60 * 1000));

		return res.status(200).json({ message: 'Access token refreshed' });
	} catch (error) {
		return res.status(500).json({ message: 'Server error' });
	}
};

export const getProfile = async (req, res) => {
	try {
		return res.json(req.user);
	} catch (error) {
		return res.status(500).json({ message: 'Server error' });
	}
};
