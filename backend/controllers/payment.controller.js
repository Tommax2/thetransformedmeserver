import Order from '../models/order.model.js';
import User from '../models/user.model.js';
import Product from '../models/product.model.js';

export const checkout = async (req, res) => {
    try {
        const user = req.user;
        const cartItems = user.cartItems;

        if (cartItems.length === 0) {
            return res.status(400).json({ message: 'Cart is empty' });
        }

        // Get products
        const products = await Product.find({ 
            _id: { $in: cartItems.map(item => item.productId) } 
        });

        // Check if all products exist
        if (products.length !== cartItems.length) {
            return res.status(400).json({ 
                message: 'Some products are no longer available' 
            });
        }

        // Calculate total
        let totalAmount = 0;
        const orderProducts = cartItems.map(item => {
            const product = products.find(p => p._id.toString() === item.productId.toString());
            if (!product) {
                throw new Error(`Product not found: ${item.productId}`);
            }
            totalAmount += product.price * item.quantity;
            return {
                product: item.productId,
                quantity: item.quantity,
                price: product.price,
            };
        });

        // Round total to 2 decimal places
        totalAmount = Math.round(totalAmount * 100) / 100;

        // Create order
        const order = await Order.create({
            user: user._id,
            products: orderProducts,
            totalAmount,
        });

        // Clear cart
        await User.findByIdAndUpdate(user._id, { $set: { cartItems: [] } });

        // Generate WhatsApp link
        const whatsappLink = generateWhatsAppLink(user, products, orderProducts, totalAmount, order._id);

        res.status(200).json({ 
            message: 'Order placed successfully', 
            orderId: order._id,
            totalAmount,
            whatsappLink  // Send this to frontend
        });

    } catch (error) {
        console.error('Error during checkout:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
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
