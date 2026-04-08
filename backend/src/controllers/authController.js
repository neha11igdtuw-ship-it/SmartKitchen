import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { signUserToken, verifyUserToken } from '../utils/jwt.js';

function publicUser(doc) {
  if (!doc) return null;
  const o = doc.toObject ? doc.toObject({ getters: true }) : { ...doc };
  delete o.password;
  return {
    id: o._id ? String(o._id) : String(doc._id),
    name: o.name,
    email: o.email,
    role: o.role || 'Member',
  };
}

export async function register(req, res) {
  try {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email, and password are required' });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    const pwd = hashPassword(password);
    const doc = await User.create({
      name: String(name).trim(),
      email: String(email).trim().toLowerCase(),
      password: pwd,
      role: 'Member',
    });
    const token = signUserToken(doc._id.toString());
    res.status(201).json({ token, user: publicUser(doc) });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }
    const doc = await User.findOne({ email: String(email).trim().toLowerCase() }).select('+password');
    if (!doc || !doc.password) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    if (!verifyPassword(password, doc.password)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const token = signUserToken(doc._id.toString());
    res.json({ token, user: publicUser(doc) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
}

export async function me(req, res) {
  try {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const payload = verifyUserToken(auth.slice(7));
    if (!payload || !payload.sub || !mongoose.isValidObjectId(payload.sub)) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    const doc = await User.findById(payload.sub).lean();
    if (!doc) return res.status(404).json({ error: 'User not found' });
    res.json({ user: publicUser(doc) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load profile' });
  }
}
