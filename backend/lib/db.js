import mongoose from "mongoose";

export const connectDB = async () => {
    const maxRetries = 5;
    let retries = 0;

    while (retries < maxRetries) {
        try {
            const conn = await mongoose.connect(process.env.MONGO_URI, {
                serverSelectionTimeoutMS: 10000, // 10s timeout
                socketTimeoutMS: 45000,
                maxPoolSize: Number(process.env.MONGO_MAX_POOL_SIZE || 100),
                minPoolSize: Number(process.env.MONGO_MIN_POOL_SIZE || 10),
                maxIdleTimeMS: Number(process.env.MONGO_MAX_IDLE_TIME_MS || 30000),
            });
            console.log(`MongoDB Connected: ${conn.connection.host}`);
            return; // Success
        } catch (error) {
            retries++;
            console.error(`MongoDB connection attempt ${retries} failed: ${error.message}`);
            if (retries >= maxRetries) {
                console.error("Max retries reached. Exiting...");
                process.exit(1);
            }
            // Wait for 2 seconds before retrying
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
};
