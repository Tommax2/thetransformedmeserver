import mongoose from "mongoose";
import { PRODUCT_CATEGORIES } from "../constants/productCategories.js";

const productSchema = new mongoose.Schema({
    name:
     { type: String, 
        required: true
    },
    description:
     { type: String, 
        required: true
    },
    price:
     { type: Number, 
        required: true
    },
    image:
        { type: String,
        required: [true, 'Please add an image']
        },
    category:
     { type: String, 
        required: true,
        enum: PRODUCT_CATEGORIES
    },
    isFeatured:{
        type:Boolean,
        default:false
    },
    courseFiles: [{
        name: { type: String, required: true },
        url: { type: String, required: true },
        type: { type: String, enum: ['pdf', 'video', 'audio', 'document', 'other'], default: 'other' }
    }]
},{timestamps: true});

const Product = mongoose.model('Product', productSchema);

export default Product;
