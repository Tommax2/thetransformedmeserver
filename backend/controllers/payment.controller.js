import Order from '../models/order.model.js';
import User from '../models/user.model.js';
import Product from '../models/product.model.js';
import { getStripe } from '../lib/stripe.js';
import { sendEmail } from '../lib/email.js';

const normalizePhoneNumberForWhatsApp = (phone) => {
	if (!phone) return null;
	return String(phone).replace(/[^\d]/g, '');
};

const buildWhatsAppLink = ({ phone, message }) => {
	const cleanPhone = normalizePhoneNumberForWhatsApp(phone);
	if (!cleanPhone) return null;
	const encodedMessage = message ? encodeURIComponent(message) : '';
	return encodedMessage
		? `https://wa.me/${cleanPhone}?text=${encodedMessage}`
		: `https://wa.me/${cleanPhone}`;
};

const formatMoney = (amount, currency) => {
	const safeAmount = Number(amount || 0);
	const safeCurrency = String(currency || 'usd').toUpperCase();
	try {
		return new Intl.NumberFormat('en', {
			style: 'currency',
			currency: safeCurrency,
		}).format(safeAmount);
	} catch {
		return `${safeCurrency} ${safeAmount.toFixed(2)}`;
	}
};

const buildPaymentSuccessEmail = ({
	name,
	orderId,
	items,
	total,
	currency,
	whatsappLink,
}) => {
	const greetingName = name || 'there';
	const totalText = formatMoney(total, currency);

	const itemsHtml =
		items && items.length
			? `<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>`
			: '';

	const whatsappCta = whatsappLink
		? `<p><a href="${whatsappLink}">Message us on WhatsApp</a> to get your course access.</p>`
		: `<p>Reply to this email for help accessing your course.</p>`;

	const html =
		`<p>Hi ${greetingName},</p>` +
		`<p>Your payment was successful.</p>` +
		(orderId ? `<p><b>Order ID:</b> ${orderId}</p>` : '') +
		(itemsHtml ? `<p><b>Items:</b></p>${itemsHtml}` : '') +
		`<p><b>Total:</b> ${totalText}</p>` +
		whatsappCta +
		`<p>Thank you,<br/>The Transformed Me Academy</p>`;

	const text =
		`Hi ${greetingName},\n\n` +
		`Your payment was successful.\n` +
		(orderId ? `Order ID: ${orderId}\n` : '') +
		(items && items.length ? `Items:\n- ${items.join('\n- ')}\n` : '') +
		`Total: ${totalText}\n\n` +
		(whatsappLink ? `WhatsApp: ${whatsappLink}\n` : '') +
		`\nThe Transformed Me Academy`;

	return { html, text };
};

export const createStripeCheckoutSession = async (req, res) => {
	try {
		const stripe = getStripe();
		const user = req.user;
		const cartItems = user.cartItems || [];

		if (cartItems.length === 0) {
			return res.status(400).json({ message: "Cart is empty" });
		}

		const products = await Product.find({
			_id: { $in: cartItems.map((item) => item.productId) },
		});

		if (products.length !== cartItems.length) {
			return res
				.status(400)
				.json({ message: "Some products are no longer available" });
		}

		const currency = (process.env.STRIPE_CURRENCY || "usd").toLowerCase();

		let totalAmount = 0;
		const orderProducts = cartItems.map((item) => {
			const product = products.find(
				(p) => p._id.toString() === item.productId.toString()
			);
			if (!product) throw new Error(`Product not found: ${item.productId}`);

			totalAmount += product.price * item.quantity;

			return {
				product: item.productId,
				quantity: item.quantity,
				price: product.price,
			};
		});

		totalAmount = Math.round(totalAmount * 100) / 100;

		const order = await Order.create({
			user: user._id,
			paymentProvider: "stripe",
			paymentStatus: "pending",
			currency,
			products: orderProducts,
			totalAmount,
		});

		const clientUrl =
			(process.env.CLIENT_URL || process.env.SITE_URL || "http://localhost:5173").replace(
				/\/$/,
				""
			);
		const successUrl =
			process.env.STRIPE_SUCCESS_URL ||
			`${clientUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`;
		const cancelUrl =
			process.env.STRIPE_CANCEL_URL || `${clientUrl}/cart?canceled=true`;

		const line_items = orderProducts.map((item) => {
			const product = products.find(
				(p) => p._id.toString() === item.product.toString()
			);
			const unitAmount = Math.round(Number(item.price) * 100);
			const images = product?.image ? [product.image] : undefined;

			return {
				quantity: item.quantity,
				price_data: {
					currency,
					unit_amount: unitAmount,
					product_data: {
						name: product?.name || "Item",
						...(images ? { images } : {}),
					},
				},
			};
		});

		const session = await stripe.checkout.sessions.create({
			mode: "payment",
			line_items,
			success_url: successUrl,
			cancel_url: cancelUrl,
			customer_email: user.email,
			client_reference_id: order._id.toString(),
			metadata: {
				orderId: order._id.toString(),
				userId: user._id.toString(),
			},
		});

		await Order.findByIdAndUpdate(order._id, {
			$set: { stripeSessionId: session.id },
		});

		res.status(200).json({
			orderId: order._id,
			sessionId: session.id,
			url: session.url,
		});
	} catch (error) {
		console.error("Error creating Stripe Checkout session:", error);
		res.status(500).json({ message: "Server Error", error: error.message });
	}
};

export const stripeWebhook = async (req, res) => {
	const stripe = getStripe();
	const signature = req.headers["stripe-signature"];

	if (!process.env.STRIPE_WEBHOOK_SECRET) {
		return res
			.status(500)
			.json({ message: "STRIPE_WEBHOOK_SECRET is not configured" });
	}

	let event;
	try {
		event = stripe.webhooks.constructEvent(
			req.body,
			signature,
			process.env.STRIPE_WEBHOOK_SECRET
		);
	} catch (err) {
		console.error("Stripe webhook signature verification failed:", err.message);
		return res.status(400).send(`Webhook Error: ${err.message}`);
	}

	try {
		switch (event.type) {
			case "checkout.session.completed": {
				const session = event.data.object;
				const orderId = session?.metadata?.orderId || session?.client_reference_id;
				const userId = session?.metadata?.userId;

				let order = null;

				if (orderId) {
					await Order.findByIdAndUpdate(orderId, {
						$set: {
							paymentStatus: "paid",
							stripePaymentIntentId: session.payment_intent,
							paidAt: new Date(),
						},
					});

					order = await Order.findById(orderId)
						.populate("user")
						.populate("products.product");
				}

				if (userId) {
					await User.findByIdAndUpdate(userId, { $set: { cartItems: [] } });
				}

				if (order && !order.paymentConfirmationEmailSentAt) {
					const toEmail = order?.user?.email || session?.customer_email;
					const supportPhone = process.env.COURSE_WHATSAPP_NUMBER;

					const itemNames =
						order.products?.map((p) => p?.product?.name || "Item") || [];
					const whatsappMessage =
						`Hi, I just completed payment for ${itemNames.join(", ") || "my course"}. ` +
						`My order ID is ${order._id}. Please send my course access details.`;
					const whatsappLink = buildWhatsAppLink({
						phone: supportPhone,
						message: whatsappMessage,
					});

					if (!toEmail) {
						await Order.findByIdAndUpdate(order._id, {
							$set: {
								paymentConfirmationEmailError:
									"No customer email found to send confirmation",
							},
						});
					} else {
						try {
							const { html, text } = buildPaymentSuccessEmail({
								name: order?.user?.name,
								orderId: order._id.toString(),
								items: itemNames,
								total: order.totalAmount,
								currency: order.currency,
								whatsappLink,
							});

							await sendEmail({
								to: toEmail,
								subject: "Payment successful - course access",
								html,
								text,
							});

							await Order.findByIdAndUpdate(order._id, {
								$set: { paymentConfirmationEmailSentAt: new Date() },
								$unset: { paymentConfirmationEmailError: "" },
							});
						} catch (emailError) {
							console.error(
								"Failed to send payment confirmation email:",
								emailError
							);
							await Order.findByIdAndUpdate(order._id, {
								$set: {
									paymentConfirmationEmailError:
										emailError?.message ||
										"Failed to send payment confirmation email",
								},
							});
						}
					}
				}

				break;
			}

			case "checkout.session.async_payment_failed": {
				const session = event.data.object;
				const orderId = session?.metadata?.orderId || session?.client_reference_id;
				if (orderId) {
					await Order.findByIdAndUpdate(orderId, {
						$set: { paymentStatus: "failed" },
					});
				}
				break;
			}

			default:
				break;
		}

		return res.status(200).json({ received: true });
	} catch (error) {
		console.error("Error handling Stripe webhook:", error);
		return res.status(500).json({ message: "Webhook handler error" });
	}
};

// Function to generate WhatsApp link
function generateWhatsAppLink(user, products, orderProducts, totalAmount, orderId) {
    // Build product list
    const productsList = orderProducts.map(p => {
        const prod = products.find(pr => pr._id.toString() === p.product.toString());
        return `• ${prod.name} (x${p.quantity}) - ₦${(prod.price * p.quantity).toFixed(2)}`;
    }).join('\n');

    // Create message
    const message = `🛒 *NEW ORDER*\n\n` +
        `Order ID: ${orderId}\n\n` +
        `👤 Customer: ${user.name}\n` +
        `📧 Email: ${user.email}\n` +
        `📱 Phone: ${user.phone || 'N/A'}\n\n` +
        `📦 *Products:*\n${productsList}\n\n` +
        `💰 *Total: ₦${totalAmount.toFixed(2)}*`;

    // Get owner phone number from env (without + sign)
    const ownerPhone = process.env.OWNER_PHONE_NUMBER || '2348012345678';
    
    // Remove any + or spaces from phone number
    const cleanPhone = ownerPhone.replace(/[\s+]/g, '');

    // Encode message for URL
    const encodedMessage = encodeURIComponent(message);

    // Generate WhatsApp link
    return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
}
