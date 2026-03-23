import Stripe from "stripe";

let stripeClient = null;

export const getStripe = () => {
	if (stripeClient) return stripeClient;

	const secretKey = process.env.STRIPE_SECRET_KEY;
	if (!secretKey) {
		throw new Error("STRIPE_SECRET_KEY is required");
	}

	stripeClient = new Stripe(secretKey);
	return stripeClient;
};

