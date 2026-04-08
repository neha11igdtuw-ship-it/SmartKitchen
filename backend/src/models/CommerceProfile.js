import mongoose from 'mongoose';

/** Linked e-commerce app / grocery platform (Codolio-style “connected profile”). */
const commerceProfileSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    platform: { type: String, required: true, trim: true, maxlength: 80 },
    label: { type: String, trim: true, maxlength: 100 },
    notes: { type: String, maxlength: 500 },
  },
  { timestamps: true }
);

commerceProfileSchema.index({ userId: 1, platform: 1 });

export const CommerceProfile = mongoose.model('CommerceProfile', commerceProfileSchema);
