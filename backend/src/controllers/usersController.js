import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { Recipe } from '../models/Recipe.js';

/** Fields safe to return to clients (never includes password hash). */
const PUBLIC_USER_FIELDS = 'name email country role createdAt updatedAt';

function invalidId(res) {
  return res.status(400).json({ error: 'Invalid id' });
}

export async function listUsers(req, res) {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    const items = await User.find()
      .select(PUBLIC_USER_FIELDS)
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean();
    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list users' });
  }
}

export async function getUser(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return invalidId(res);
    const doc = await User.findById(id).select(PUBLIC_USER_FIELDS).lean();
    if (!doc) return res.status(404).json({ error: 'User not found' });
    res.json(doc);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load user' });
  }
}

export async function createUser(req, res) {
  try {
    const { name, email, role, country } = req.body || {};
    if (!name || !email) {
      return res.status(400).json({ error: 'name and email are required' });
    }
    const cc =
      country != null && String(country).trim()
        ? String(country).trim().toUpperCase().slice(0, 2)
        : '';
    const doc = await User.create({
      name,
      email,
      role,
      country: /^[A-Z]{2}$/.test(cc) ? cc : '',
    });
    const safe = await User.findById(doc._id).select(PUBLIC_USER_FIELDS).lean();
    res.status(201).json(safe);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Email already exists' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to create user' });
  }
}

export async function updateUser(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return invalidId(res);
    const { name, email, role, country } = req.body || {};
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email;
    if (role !== undefined) updates.role = role;
    if (country !== undefined) {
      const cc = String(country).trim().toUpperCase().slice(0, 2);
      updates.country = /^[A-Z]{2}$/.test(cc) ? cc : '';
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    const doc = await User.findByIdAndUpdate(id, { $set: updates }, {
      new: true,
      runValidators: true,
    })
      .select(PUBLIC_USER_FIELDS)
      .lean();
    if (!doc) return res.status(404).json({ error: 'User not found' });
    res.json(doc);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Email already exists' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to update user' });
  }
}

export async function deleteUser(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return invalidId(res);
    const doc = await User.findByIdAndDelete(id);
    if (!doc) return res.status(404).json({ error: 'User not found' });
    await Recipe.updateMany({ userId: id }, { $set: { userId: null } });
    res.json({ success: true, id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
}
