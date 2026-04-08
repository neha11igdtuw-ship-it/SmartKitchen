import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 254 },
    role: { type: String, trim: true, default: 'Member', maxlength: 40 },
    /** PBKDF2 hash (salt:hash) — never returned in API responses */
    password: { type: String, select: false },
  },
  { timestamps: true }
);

userSchema.index({ email: 1 });

export const User = mongoose.model('User', userSchema);
