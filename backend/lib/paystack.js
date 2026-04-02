import Paystack from "paystack-api";

let paystackClient = null;

export const getPaystack = () => {
	if (paystackClient) return paystackClient;

	const secretKey = process.env.PAYSTACK_SECRET_KEY;
	if (!secretKey) {
		throw new Error("PAYSTACK_SECRET_KEY is required");
	}

	paystackClient = new Paystack(secretKey);
	return paystackClient;
};