import mongoose from 'mongoose';

const dealSchema = new mongoose.Schema(
  {
    productName: { type: String, required: true, trim: true, maxlength: 200 },
    quantity: { type: String, required: true, trim: true, maxlength: 100 },
    expiryDate: { type: Date, required: true },
    discountPrice: { type: Number, required: true, min: 0 },
    originalPrice: { type: Number, min: 0 },
    shopName: { type: String, required: true, trim: true, maxlength: 120 },
    location: { type: String, trim: true, maxlength: 200 },
    shopkeeperId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shopkeeper', default: null },
  },
  { timestamps: true }
);

export const Deal = mongoose.model('Deal', dealSchema);
