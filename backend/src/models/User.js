import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    /** Display name (stored as plain text; needed for the app UI). */
    name: { type: String, required: true, trim: true, maxlength: 120 },
    /** Login identifier; unique, normalized to lowercase. */
    email: { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 254 },
    /** ISO 3166-1 alpha-2 (e.g. IN, US) from signup / settings */
    country: { type: String, trim: true, uppercase: true, maxlength: 2, default: '' },
    role: { type: String, trim: true, default: 'Member', maxlength: 40 },
    /**
     * One-way password hash only (PBKDF2 salt:hash). Plain passwords are never persisted.
     * select: false + toJSON transform so hashes never leak in API responses.
     */
    password: { type: String, select: false },
  },
  { timestamps: true }
);

function stripSecrets(_doc, ret) {
  delete ret.password;
  delete ret.__v;
  return ret;
}

userSchema.set('toJSON', {
  transform(_doc, ret) {
    return stripSecrets(_doc, ret);
  },
});
userSchema.set('toObject', {
  transform(_doc, ret) {
    return stripSecrets(_doc, ret);
  },
});

export const User = mongoose.model('User', userSchema);
