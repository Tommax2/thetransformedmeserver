import mongoose from "mongoose";

const DEFAULT_CONNECT_OPTIONS = {
	serverSelectionTimeoutMS: 10000,
	socketTimeoutMS: 45000,
	maxPoolSize: Number(process.env.MONGO_MAX_POOL_SIZE || 100),
	minPoolSize: Number(process.env.MONGO_MIN_POOL_SIZE || 10),
	maxIdleTimeMS: Number(process.env.MONGO_MAX_IDLE_TIME_MS || 30000),
};

const MAX_RETRIES = Number(process.env.MONGO_CONNECT_MAX_RETRIES || 5);
const RETRY_DELAY_MS = Number(process.env.MONGO_RETRY_DELAY_MS || 5000);

let isConnecting = false;

export const connectDB = async () => {
	if (mongoose.connection.readyState === 1) {
		return mongoose.connection;
	}

	if (isConnecting) {
		return mongoose.connection;
	}

	isConnecting = true;
	let retries = 0;

	while (retries < MAX_RETRIES) {
		try {
			const conn = await mongoose.connect(
				process.env.MONGO_URI,
				DEFAULT_CONNECT_OPTIONS
			);
			console.log(`MongoDB Connected: ${conn.connection.host}`);
			isConnecting = false;
			return conn.connection;
		} catch (error) {
			retries += 1;
			console.error(
				`MongoDB connection attempt ${retries} failed: ${error.message}`
			);

			if (retries >= MAX_RETRIES) {
				isConnecting = false;
				throw error;
			}

			await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
		}
	}

	isConnecting = false;
	return mongoose.connection;
};

export const initDBConnection = async () => {
	try {
		await connectDB();
	} catch (error) {
		console.error(
			'Initial MongoDB connection failed. Server will stay up and retry in background.'
		);

		setTimeout(() => {
			initDBConnection().catch(() => {});
		}, RETRY_DELAY_MS);
	}
};

mongoose.connection.on('disconnected', () => {
	console.warn('MongoDB disconnected. Retrying connection in background...');
	setTimeout(() => {
		initDBConnection().catch(() => {});
	}, RETRY_DELAY_MS);
});
