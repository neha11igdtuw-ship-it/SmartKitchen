import mongoose from 'mongoose';

const FOOD_CATEGORIES = [
  'Bakery',
  'Produce',
  'Dairy',
  'Grains',
  'Pantry',
  'Beverages',
  'Snacks',
  'Frozen',
  'Other',
];

const commercePurchaseSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    commerceProfileId: { type: mongoose.Schema.Types.ObjectId, ref: 'CommerceProfile', default: null },
    platform: { type: String, required: true, trim: true, maxlength: 80 },
    purchasedAt: { type: Date, required: true, index: true },
    itemName: { type: String, required: true, trim: true, maxlength: 200 },
    category: { type: String, required: true, trim: true, maxlength: 40 },
    quantity: { type: Number, default: 1, min: 0 },
    unit: { type: String, trim: true, maxlength: 24, default: 'units' },
    amountInr: { type: Number, min: 0 },
    source: { type: String, enum: ['manual', 'import'], default: 'manual' },
  },
  { timestamps: true }
);

commercePurchaseSchema.index({ userId: 1, purchasedAt: -1 });

export const CommercePurchase = mongoose.model('CommercePurchase', commercePurchaseSchema);
export const commerceFoodCategories = FOOD_CATEGORIES;
