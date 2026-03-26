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
      ? items.map((i) => `<tr><td style="padding:6px 0;font-size:15px;font-weight:500">${i}</td></tr>`).join('')
      : `<tr><td style="padding:6px 0;font-size:15px;font-weight:500">—</td></tr>`;

  const whatsappCta = whatsappLink
    ? `<div style="text-align:center;margin:0 0 28px">
        <a href="${whatsappLink}" style="display:inline-block;background:#25D366;color:#fff;text-decoration:none;padding:12px 28px;border-radius:99px;font-size:15px;font-weight:500">Message us on WhatsApp</a>
       </div>`
    : `<p style="font-size:14px;color:#6b7280">Reply to this email for help accessing your course.</p>`;

  const nextStepsNote = whatsappLink
    ? `To access your course, please message us on WhatsApp using the link below, and our team will get you set up promptly.`
    : `Reply to this email and our team will get you set up promptly.`;

  const html = `
    <p style="margin:0 0 20px;font-size:16px">Hi <b>${greetingName}</b>,</p>
    <p style="margin:0 0 20px;font-size:16px">Your payment was successful—welcome to <b>The Transformed Me Academy!</b></p>

    <div style="background:#f9f9f9;border-radius:8px;padding:20px 24px;margin:0 0 24px;border:1px solid #e5e7eb">
      <div style="font-size:12px;color:#6b7280;margin-bottom:12px;letter-spacing:.04em;text-transform:uppercase;font-weight:500">Order Summary</div>
      ${orderId ? `
      <div style="display:flex;justify-content:space-between;margin-bottom:8px">
        <span style="font-size:13px;color:#6b7280">Order ID</span>
        <span style="font-size:13px;font-family:monospace">${orderId}</span>
      </div>
      <div style="border-top:1px solid #e5e7eb;margin:10px 0"></div>` : ''}
      <div style="font-size:13px;color:#6b7280;margin-bottom:6px">Your Purchase</div>
      <table style="width:100%;border-collapse:collapse">${itemsHtml}</table>
      <div style="border-top:1px solid #e5e7eb;margin:10px 0"></div>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:13px;color:#6b7280">Total Paid</span>
        <span style="font-size:17px;font-weight:500">${totalText}</span>
      </div>
    </div>

    <div style="background:#f0f9ff;border-left:3px solid #3b82f6;border-radius:0 8px 8px 0;padding:16px 20px;margin:0 0 24px">
      <div style="font-weight:500;margin-bottom:6px;font-size:15px">Next Steps</div>
      <p style="margin:0;font-size:14px;color:#4b5563;line-height:1.6">${nextStepsNote}</p>
    </div>

    ${whatsappCta}

    <p style="margin:0 0 20px;font-size:14px;color:#6b7280;line-height:1.6">If you have any questions or need assistance, feel free to reach out—we're here to support you every step of the way.</p>
    <p style="margin:0 0 8px;font-size:14px;color:#6b7280">Thank you for choosing The Transformed Me Academy. We're excited to be part of your journey!</p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0 16px"/>
    <p style="margin:0;font-size:14px;color:#6b7280">Warm regards,<br><b>The Transformed Me Academy Team</b></p>
  `;

  const text =
    `Hi ${greetingName},\n\n` +
    `Your payment was successful—welcome to The Transformed Me Academy!\n\n` +
    (orderId ? `Order ID: ${orderId}\n\n` : '') +
    `Your Purchase:\n` +
    (items && items.length ? items.join('\n') + '\n\n' : '') +
    `Total Paid: ${totalText}\n\n` +
    `Next Steps:\n` +
    (whatsappLink
      ? `To access your course, please message us on WhatsApp:\n${whatsappLink}\n\n`
      : `Reply to this email for help accessing your course.\n\n`) +
    `If you have any questions or need assistance, feel free to reach out.\n\n` +
    `Thank you for choosing The Transformed Me Academy. We're excited to be part of your journey!\n\n` +
    `Warm regards,\nThe Transformed Me Academy Team`;

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
    `${clientUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;
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
export const getStripeSession = async (req, res) => {
    try {
        const stripe = getStripe();
        const { session_id } = req.query;

        if (!session_id) {
            return res.status(400).json({ message: "session_id is required" });
        }

        const session = await stripe.checkout.sessions.retrieve(session_id, {
            expand: ["line_items"],
        });

        res.status(200).json({
            email: session.customer_email,
            items: session.line_items?.data?.map((i) => ({
                name: i.description,
                quantity: i.quantity,
            })),
            metadata: session.metadata,
        });
    } catch (error) {
        console.error("Error retrieving Stripe session:", error);
        res.status(500).json({ message: "Failed to retrieve session" });
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
