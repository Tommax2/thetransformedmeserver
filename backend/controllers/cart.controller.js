import Product from "../models/product.model.js";
import User from "../models/user.model.js";

export const getCartProducts = async (req, res) => {
	try {
		const products = await Product.find({ _id: { $in: req.user.cartItems.map((item) => item.productId) } });

		// add quantity to each product
		const cartItems = products.map((product) => {
			const item = req.user.cartItems.find((cartItem) => cartItem.productId.toString() === product._id.toString());
			return { ...product.toJSON(), quantity: item.quantity };
		});

		res.json(cartItems);
	} catch (error) {
		console.log("Error in getCartProducts controller", error.message);
		res.status(500).json({ message: "Server error", error: error.message });
	}
};

export const addToCart = async (req, res) => {
	try {
		const { productId } = req.body;
		const userId = req.user._id;

		let user = await User.findOneAndUpdate(
			{ _id: userId, "cartItems.productId": productId },
			{ $inc: { "cartItems.$.quantity": 1 } },
			{ new: true }
		);

		if (!user) {
			user = await User.findByIdAndUpdate(
				userId,
				{ $push: { cartItems: { productId, quantity: 1 } } },
				{ new: true }
			);
		}

		res.json(user.cartItems);
	} catch (error) {
		console.log("Error in addToCart controller", error.message);
		res.status(500).json({ message: "Server error", error: error.message });
	}
};

export const removeFromCart = async (req, res) => {
	try {
		const { productId } = req.body;
		const userId = req.user._id;

		let user;
		if (!productId) {
			user = await User.findByIdAndUpdate(userId, { $set: { cartItems: [] } }, { new: true });
		} else {
			user = await User.findByIdAndUpdate(
				userId,
				{ $pull: { cartItems: { productId: productId } } },
				{ new: true }
			);
		}

		if (!user) {
			return res.status(404).json({ message: "User not found" });
		}

		res.json(user.cartItems);
	} catch (error) {
		console.log("Error in removeFromCart controller", error.message);
		res.status(500).json({ message: "Server error", error: error.message });
	}
};

export const updateCartItem = async (req, res) => {
	try {
		const { id: productId } = req.params;
		const { quantity } = req.body;
		const userId = req.user._id;

		if (quantity === 0) {
			const user = await User.findByIdAndUpdate(
				userId,
				{ $pull: { cartItems: { productId: productId } } },
				{ new: true }
			);
			return res.json(user.cartItems);
		}

		const user = await User.findOneAndUpdate(
			{ _id: userId, "cartItems.productId": productId },
			{ $set: { "cartItems.$.quantity": quantity } },
			{ new: true }
		);

		if (!user) {
			return res.status(404).json({ message: "Product not found in cart" });
		}

		res.json(user.cartItems);
	} catch (error) {
		console.log("Error in updateQuantity controller", error.message);
		res.status(500).json({ message: "Server error", error: error.message });
	}
};
