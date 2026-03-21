import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';
import authRoutes from './routes/auth.route.js';
import { connectDB } from './lib/db.js';
import cookieParser from 'cookie-parser';
import productRoutes from './routes/product.route.js';
import cartRoutes from './routes/cart.route.js';
import paymentRoutes from './routes/payment.route.js';
import analyticsRoutes from './routes/analytics.route.js';

dotenv.config();

const app = express();

const PORT = process.env.PORT || 5000;
const __dirname = path.resolve();
const SITE_URL = process.env.SITE_URL || "https://www.thetransformedmeacademy.com";

const allowedOrigins = Array.from(
	new Set(
		[
			...(process.env.CLIENT_URLS || "").split(","),
			process.env.CLIENT_URL,
			"http://localhost:5173",
			"https://thetransformedmeacademy.vercel.app",
			"https://thetransformedmeacademy.com",
			"https://www.thetransformedmeacademy.com",
			SITE_URL,
		]
			.filter(Boolean)
			.map((o) => o.trim())
			.filter(Boolean)
	)
);

const corsOptions = {
	origin: (origin, callback) => {
		// Allow non-browser tools (no Origin header)
		if (!origin) return callback(null, true);

		if (allowedOrigins.includes(origin)) return callback(null, true);

		return callback(new Error(`CORS blocked for origin: ${origin}`));
	},
	credentials: true,
	methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
	optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json(  {  limit:"10mb"  }));
app.use(cookieParser());

// Serve robots.txt from the backend to avoid accidental indexing blocks from stale build artifacts.
app.get("/robots.txt", (req, res) => {
    res.type("text/plain").send(
        `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`
    );
});

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/analytics', analyticsRoutes);

if (process.env.NODE_ENV === "production") {
    app.use(express.static(path.join(__dirname, "/frontend/thetransformedmeacademy/dist")));

    app.get(/.*/, (req, res) => {
        res.sendFile(path.resolve(__dirname, "frontend", "thetransformedmeacademy", "dist", "index.html"));
    });
}

const startServer = async () => {
    try {
        await connectDB();
        app.listen(PORT, () => {
            console.log('Server is running Http://localhost:' + PORT);
        });
    } catch (error) {
        console.error("Failed to start server:", error.message);
        process.exit(1);
    }
};

startServer();
