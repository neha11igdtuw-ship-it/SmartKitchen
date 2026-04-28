import mongoose from 'mongoose';

/** Linked e-commerce app / grocery platform (Codolio-style “connected profile”). */
const commerceProfileSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    platform: { type: String, required: true, trim: true, maxlength: 80 },
    label: { type: String, trim: true, maxlength: 100 },
    /** User-pasted order/account page URL (bookmark only — we do not fetch merchant data automatically). */
    profileUrl: { type: String, trim: true, maxlength: 2048, default: '' },
    notes: { type: String, maxlength: 500 },
  },
  { timestamps: true }
);

commerceProfileSchema.index({ userId: 1, platform: 1 });

export const CommerceProfile = mongoose.model('CommerceProfile', commerceProfileSchema);
