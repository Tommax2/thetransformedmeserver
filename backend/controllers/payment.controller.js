import Order from '../models/order.model.js';
import User from '../models/user.model.js';
import Product from '../models/product.model.js';
import { getStripe } from '../lib/stripe.js';
import { getPaystack } from '../lib/paystack.js';
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
  courseFiles = [],
}) => {
  const greetingName = name || 'there';
  const totalText = formatMoney(total, currency);

  const itemsHtml =
    items && items.length
      ? items.map((i) => `<tr><td style="padding:6px 0;font-size:15px;font-weight:500">${i}</td></tr>`).join('')
      : `<tr><td style="padding:6px 0;font-size:15px;font-weight:500">—</td></tr>`; 

  const courseFilesHtml = courseFiles && courseFiles.length
    ? courseFiles.map((file) => 
        `<tr>
          <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;">
            <div style="display:flex;align-items:center;gap:12px;">
              <span style="font-size:14px;font-weight:500">${file.name}</span>
              <a href="${file.url}" style="display:inline-block;background:#10b981;color:#fff;text-decoration:none;padding:6px 12px;border-radius:4px;font-size:12px;font-weight:500" target="_blank">Download</a>
            </div>
          </td>
        </tr>`
      ).join('')
    : '';

  const courseAccessSection = courseFiles && courseFiles.length ? `
    <div style="background:#f0fdf4;border-left:3px solid #10b981;border-radius:0 8px 8px 0;padding:16px 20px;margin:0 0 24px">
      <div style="font-weight:500;margin-bottom:12px;font-size:15px;color:#065f46">🎓 Your Course Materials</div>
      <p style="margin:0 0 12px;font-size:14px;color:#374151;line-height:1.6">Download your course materials below. Click the download button next to each file.</p>
      <table style="width:100%;border-collapse:collapse">${courseFilesHtml}</table>
    </div>` : '';

  const nextStepsNote = courseFiles && courseFiles.length 
    ? `Your course materials are ready for download above. If you have any questions about accessing your course, feel free to reach out.`
    : `To access your course, please message us on WhatsApp using the link below, and our team will get you set up promptly.`;

  const whatsappCta = (!courseFiles || courseFiles.length === 0) ? `
    <div style="text-align:center;margin:0 0 28px">
      <a href="${buildWhatsAppLink({
        phone: process.env.COURSE_WHATSAPP_NUMBER,
        message: `Hi, I just completed payment for my course. My order ID is ${orderId}. Please send my course access details.`
      })}" style="display:inline-block;background:#25D366;color:#fff;text-decoration:none;padding:12px 28px;border-radius:99px;font-size:15px;font-weight:500">Message us on WhatsApp</a>
    </div>` : `<p style="font-size:14px;color:#6b7280;text-align:center;margin:0 0 28px">Need help? <a href="${buildWhatsAppLink({
    phone: process.env.COURSE_WHATSAPP_NUMBER,
    message: `Hi, I just completed payment for my course. My order ID is ${orderId}. I need help accessing my materials.`
  })}" style="color:#059669;text-decoration:none;font-weight:500">Contact us on WhatsApp</a></p>`;

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

    ${courseAccessSection}

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

  const courseFilesText = courseFiles && courseFiles.length
    ? '\n\nYour Course Materials:\n' + courseFiles.map(file => `• ${file.name}: ${file.url}`).join('\n')
    : '';

  const text =
    `Hi ${greetingName},\n\n` +
    `Your payment was successful—welcome to The Transformed Me Academy!\n\n` +
    (orderId ? `Order ID: ${orderId}\n\n` : '') +
    `Your Purchase:\n` +
    (items && items.length ? items.join('\n') + '\n\n' : '') +
    `Total Paid: ${totalText}${courseFilesText}\n\n` +
    `Next Steps:\n` +
    (courseFiles && courseFiles.length
      ? `Your course materials are available for download using the links above.`
      : `To access your course, please message us on WhatsApp:\n${buildWhatsAppLink({
        phone: process.env.COURSE_WHATSAPP_NUMBER,
        message: `Hi, I just completed payment for my course. My order ID is ${orderId}. Please send my course access details.`
      })}\n\n`) +
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

		// Get conversion rate from GBP to target currency
		let conversionRate = 1; // default for GBP
		if (currency === 'usd') {
			// If needed, but currently gbp
		}

		let totalAmount = 0;
		const orderProducts = cartItems.map((item) => {
			const product = products.find(
				(p) => p._id.toString() === item.productId.toString()
			);
			if (!product) throw new Error(`Product not found: ${item.productId}`);

			const convertedPrice = product.price * conversionRate;
			totalAmount += convertedPrice * item.quantity;

			return {
				product: item.productId,
				quantity: item.quantity,
				price: convertedPrice,
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

export const createPaystackCheckoutSession = async (req, res) => {
	try {
		const paystack = getPaystack();
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

		const currency = (process.env.PAYSTACK_CURRENCY || "ngn").toLowerCase();

		// Get conversion rate from GBP to target currency
		let conversionRate = 1; // default for GBP
		if (currency === 'ngn') {
			conversionRate = parseFloat(process.env.GBP_TO_NGN) || 1828.92;
		}

		let totalAmount = 0;
		const orderProducts = cartItems.map((item) => {
			const product = products.find(
				(p) => p._id.toString() === item.productId.toString()
			);
			if (!product) throw new Error(`Product not found: ${item.productId}`);

			const convertedPrice = product.price * conversionRate;
			totalAmount += convertedPrice * item.quantity;

			return {
				product: item.productId,
				quantity: item.quantity,
				price: convertedPrice,
			};
		});

		totalAmount = Math.round(totalAmount * 100); // Paystack expects amount in kobo (smallest currency unit)

		const order = await Order.create({
			user: user._id,
			paymentProvider: "paystack",
			paymentStatus: "pending",
			currency,
			products: orderProducts,
			totalAmount: totalAmount / 100, // Store in major currency unit
		});

		const clientUrl =
			(process.env.CLIENT_URL || process.env.SITE_URL || "http://localhost:5173").replace(
				/\/$/,
				""
			);
		const callbackUrl = `${clientUrl}/payment/paystack/callback`;

		// Create Paystack transaction
		const transactionData = {
			amount: totalAmount,
			email: user.email,
			currency: currency.toUpperCase(),
			callback_url: callbackUrl,
			metadata: {
				orderId: order._id.toString(),
				userId: user._id.toString(),
				custom_fields: orderProducts.map((item, index) => {
					const product = products.find(
						(p) => p._id.toString() === item.product.toString()
					);
					return {
						display_name: `Item ${index + 1}`,
						variable_name: `item_${index + 1}`,
						value: product?.name || "Item",
					};
				}),
			},
		};

		const transaction = await paystack.transaction.initialize(transactionData);

		await Order.findByIdAndUpdate(order._id, {
			$set: { paystackReference: transaction.data.reference },
		});

		res.status(200).json({
			orderId: order._id,
			reference: transaction.data.reference,
			url: transaction.data.authorization_url,
		});
	} catch (error) {
		console.error("Error creating Paystack Checkout session:", error);
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
								courseFiles: order.products?.flatMap(p => p?.product?.courseFiles || []) || [],
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

export const paystackWebhook = async (req, res) => {
	try {
		const paystack = getPaystack();
		const event = req.body;

		// Verify webhook signature for production security
		const secret = process.env.PAYSTACK_SECRET_KEY;
		const signature = req.headers['x-paystack-signature'];

		if (!signature) {
			console.error('Paystack webhook signature missing');
			return res.status(400).json({ message: 'Webhook signature missing' });
		}

		// Paystack uses HMAC SHA512 for signature verification
		const crypto = await import('crypto');
		const expectedSignature = crypto.default
			.createHmac('sha512', secret)
			.update(JSON.stringify(req.body))
			.digest('hex');

		if (signature !== expectedSignature) {
			console.error('Paystack webhook signature verification failed');
			return res.status(400).json({ message: 'Invalid signature' });
		}

		console.log('Paystack webhook received:', event.event);

		if (event.event === "charge.success") {
			const { reference, status, amount, currency } = event.data;

			if (status === "success") {
				console.log('Processing successful Paystack payment:', reference);

				// Find order by Paystack reference
				const order = await Order.findOne({ paystackReference: reference })
					.populate("user")
					.populate("products.product");

				if (!order) {
					console.error('Order not found for Paystack reference:', reference);
					return res.status(404).json({ message: 'Order not found' });
				}

				if (order.paymentStatus === "paid") {
					console.log('Order already processed:', order._id);
					return res.status(200).json({ message: 'Order already processed' });
				}

				await Order.findByIdAndUpdate(order._id, {
					$set: {
						paymentStatus: "paid",
						paystackTransactionId: event.data.id,
						paidAt: new Date(),
					},
				});

				// Clear user's cart
				await User.findByIdAndUpdate(order.user._id, { $set: { cartItems: [] } });

				// Send confirmation email
				if (!order.paymentConfirmationEmailSentAt) {
					const toEmail = order?.user?.email;
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
								courseFiles: order.products?.flatMap(p => p?.product?.courseFiles || []) || [],
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

							console.log('Confirmation email sent for order:', order._id);
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
			}
		}

		return res.status(200).json({ received: true });
	} catch (error) {
		console.error("Error handling Paystack webhook:", error);
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

export const resendPaymentConfirmationEmail = async (req, res) => {
	try {
		const { orderId } = req.params;
		const user = req.user;

		if (!orderId) {
			return res.status(400).json({ message: "Order ID is required" });
		}

		// Find the order and ensure it belongs to the user
		const order = await Order.findOne({
			_id: orderId,
			user: user._id,
			paymentStatus: "paid"
		}).populate("user").populate("products.product");

		if (!order) {
			return res.status(404).json({ message: "Paid order not found" });
		}

		// Check if email was already sent recently (within last hour)
		const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
		if (order.paymentConfirmationEmailSentAt && order.paymentConfirmationEmailSentAt > oneHourAgo) {
			return res.status(429).json({
				message: "Confirmation email was sent recently. Please wait before requesting again."
			});
		}

		const toEmail = order?.user?.email;
		const supportPhone = process.env.COURSE_WHATSAPP_NUMBER;

		const itemNames = order.products?.map((p) => p?.product?.name || "Item") || [];
		const whatsappMessage =
			`Hi, I just completed payment for ${itemNames.join(", ") || "my course"}. ` +
			`My order ID is ${order._id}. Please send my course access details.`;
		const whatsappLink = buildWhatsAppLink({
			phone: supportPhone,
			message: whatsappMessage,
		});

		if (!toEmail) {
			return res.status(400).json({ message: "No email address found for this order" });
		}

		try {
			const { html, text } = buildPaymentSuccessEmail({
				name: order?.user?.name,
				orderId: order._id.toString(),
				items: itemNames,
				total: order.totalAmount,
				currency: order.currency,
				courseFiles: order.products?.flatMap(p => p?.product?.courseFiles || []) || [],
			});

			await sendEmail({
				to: toEmail,
				subject: "Payment successful - course access (resent)",
				html,
				text,
			});

			await Order.findByIdAndUpdate(order._id, {
				$set: { paymentConfirmationEmailSentAt: new Date() },
				$unset: { paymentConfirmationEmailError: "" },
			});

			res.status(200).json({
				message: "Confirmation email sent successfully",
				orderId: order._id
			});
		} catch (emailError) {
			console.error("Failed to resend payment confirmation email:", emailError);
			await Order.findByIdAndUpdate(order._id, {
				$set: {
					paymentConfirmationEmailError:
						emailError?.message ||
						"Failed to resend payment confirmation email",
				},
			});
			res.status(500).json({ message: "Failed to send email" });
		}
	} catch (error) {
		console.error("Error resending payment confirmation email:", error);
		res.status(500).json({ message: "Server Error", error: error.message });
	}
};

export const verifyPaystackPayment = async (req, res) => {
	try {
		const paystack = getPaystack();
		const reference = req.query.reference || req.query.trxref;

		if (!reference) {
			return res.status(400).json({ message: "reference or trxref is required" });
		}

		// paystack-api expects an object so it can interpolate `{reference}` in the route.
		// Passing a string throws: "Cannot use 'in' operator ..."
		const transaction = await paystack.transaction.verify({ reference });
		const tx = transaction?.data;

		if (!tx) {
			return res.status(502).json({
				message: "Invalid response from Paystack",
				paystackStatus: transaction?.status,
				paystackMessage: transaction?.message,
			});
		}

		const order = await Order.findOne({ paystackReference: tx.reference || reference })
			.populate("user")
			.populate("products.product");

		if (!order) {
			console.warn("No local order found for Paystack reference", tx.reference || reference);
			// return 200 here so frontend can still display success based on Paystack response
			return res.status(200).json({
				status: tx.status,
				reference: tx.reference,
				amount: tx.amount / 100,
				currency: tx.currency,
				metadata: tx.metadata,
				message: "Payment verified, but local order record not found",
			});
		}

		if (tx.status === "success" && order.paymentStatus !== "paid") {
			await Order.findByIdAndUpdate(order._id, {
				$set: {
					paymentStatus: "paid",
					paystackTransactionId: tx.id || order.paystackTransactionId,
					paidAt: new Date(),
				},
			});

			await User.findByIdAndUpdate(order.user._id, { $set: { cartItems: [] } });

			if (!order.paymentConfirmationEmailSentAt) {
				try {
					const toEmail = order?.user?.email;
					const itemNames = order.products?.map((p) => p?.product?.name || "Item") || [];

					if (toEmail) {
						const { html, text } = buildPaymentSuccessEmail({
							name: order?.user?.name,
							orderId: order._id.toString(),
							items: itemNames,
							total: order.totalAmount,
							currency: order.currency,
							courseFiles: order.products?.flatMap((p) => p?.product?.courseFiles || []) || [],
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
					}
				} catch (emailError) {
					console.error("Failed to send Paystack confirmation email:", emailError);
					await Order.findByIdAndUpdate(order._id, {
						$set: {
							paymentConfirmationEmailError:
								emailError?.message || "Failed to send payment confirmation email",
						},
					});
				}
			}
		}

		return res.status(200).json({
			status: tx.status,
			reference: tx.reference,
			amount: tx.amount / 100,
			currency: tx.currency,
			metadata: tx.metadata,
		});
	} catch (error) {
		console.error("Error verifying Paystack payment:", error);
		res.status(500).json({ message: "Failed to verify payment", details: error.message });
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
