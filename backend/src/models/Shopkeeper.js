import mongoose from 'mongoose';

const shopkeeperSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 254 },
    password: { type: String, required: true, select: false },
    shopName: { type: String, required: true, trim: true, maxlength: 160 },
    shopAddress: { type: String, trim: true, maxlength: 500, default: '' },
    phone: { type: String, trim: true, maxlength: 32, default: '' },
    licenseOrGst: { type: String, trim: true, maxlength: 80, default: '' },
  },
  { timestamps: true }
);

shopkeeperSchema.index({ email: 1 });

export const Shopkeeper = mongoose.model('Shopkeeper', shopkeeperSchema);
