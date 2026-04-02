import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
	{
		user: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
		paymentProvider: {
			type: String,
			enum: ["manual", "stripe", "paystack"],
			default: "manual",
		},
		paymentStatus: {
			type: String,
			enum: ["unpaid", "pending", "paid", "failed", "refunded"],
			default: "unpaid",
		},
		currency: {
			type: String,
		},
		stripeSessionId: {
			type: String,
		},
		stripePaymentIntentId: {
			type: String,
		},
		paystackReference: {
			type: String,
		},
		paystackTransactionId: {
			type: String,
		},
		paidAt: {
			type: Date,
		},
		products: [
			{
				product: {
					type: mongoose.Schema.Types.ObjectId,
					ref: "Product",
					required: true,
				},
				quantity: {
					type: Number,
					required: true,
					min: 1,
				},
				price: {
					type: Number,
					required: true,
					min: 0,
				},
			},
		],
		totalAmount: {
			type: Number,
			required: true,
			min: 0,
		},
		paymentConfirmationEmailSentAt: {
			type: Date,
		},
		paymentConfirmationEmailError: {
			type: String,
		},
	},
	{ timestamps: true }
);

const Order = mongoose.model("Order", orderSchema);

export default Order;
