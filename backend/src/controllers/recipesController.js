import mongoose from 'mongoose';
import { Recipe } from '../models/Recipe.js';

function invalidId(res) {
  return res.status(400).json({ error: 'Invalid id' });
}

export async function listRecipes(req, res) {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    const filter = {};
    if (req.query.userId && mongoose.isValidObjectId(req.query.userId)) {
      filter.userId = req.query.userId;
    }
    const items = await Recipe.find(filter)
      .sort({ updatedAt: -1 })
      .limit(limit)
      .populate('userId', 'name email')
      .lean();
    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list recipes' });
  }
}

export async function getRecipe(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return invalidId(res);
    const doc = await Recipe.findById(id).populate('userId', 'name email').lean();
    if (!doc) return res.status(404).json({ error: 'Recipe not found' });
    res.json(doc);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load recipe' });
  }
}

export async function createRecipe(req, res) {
  try {
    const body = req.body || {};
    const {
      title,
      description,
      ingredients,
      steps,
      prepTime,
      servings,
      difficulty,
      tag,
      imageUrl,
      userId,
    } = body;
    if (!title || typeof title !== 'string') {
      return res.status(400).json({ error: 'title is required' });
    }
    if (userId && !mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ error: 'Invalid userId' });
    }
    const doc = await Recipe.create({
      title,
      description,
      ingredients: Array.isArray(ingredients) ? ingredients : [],
      steps: Array.isArray(steps) ? steps : [],
      prepTime,
      servings,
      difficulty,
      tag,
      imageUrl,
      userId: userId || null,
    });
    const populated = await Recipe.findById(doc._id).populate('userId', 'name email');
    res.status(201).json(populated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create recipe' });
  }
}

export async function updateRecipe(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return invalidId(res);
    const body = req.body || {};
    const allowed = [
      'title',
      'description',
      'ingredients',
      'steps',
      'prepTime',
      'servings',
      'difficulty',
      'tag',
      'imageUrl',
      'userId',
    ];
    const updates = {};
    for (const key of allowed) {
      if (body[key] !== undefined) updates[key] = body[key];
    }
    if (updates.userId !== undefined) {
      if (updates.userId === null || updates.userId === '') updates.userId = null;
      else if (!mongoose.isValidObjectId(updates.userId)) {
        return res.status(400).json({ error: 'Invalid userId' });
      }
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    const doc = await Recipe.findByIdAndUpdate(id, { $set: updates }, { new: true, runValidators: true }).populate(
      'userId',
      'name email'
    );
    if (!doc) return res.status(404).json({ error: 'Recipe not found' });
    res.json(doc);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update recipe' });
  }
}

export async function deleteRecipe(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return invalidId(res);
    const doc = await Recipe.findByIdAndDelete(id);
    if (!doc) return res.status(404).json({ error: 'Recipe not found' });
    res.json({ success: true, id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete recipe' });
  }
}
