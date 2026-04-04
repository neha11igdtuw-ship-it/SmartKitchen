import mongoose from 'mongoose';

const recipeSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 5000, default: '' },
    ingredients: { type: [String], default: [] },
    steps: { type: [String], default: [] },
    prepTime: { type: String, trim: true, default: '' },
    servings: { type: Number, min: 1, default: 2 },
    difficulty: { type: String, trim: true, default: 'Easy' },
    tag: { type: String, trim: true, maxlength: 80, default: '' },
    imageUrl: { type: String, trim: true, maxlength: 2000, default: '' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

recipeSchema.index({ userId: 1, updatedAt: -1 });

export const Recipe = mongoose.model('Recipe', recipeSchema);
