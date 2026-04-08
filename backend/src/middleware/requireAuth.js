import mongoose from 'mongoose';
import { verifyUserToken } from '../utils/jwt.js';

/**
 * Sets req.userId from Bearer JWT (same secret as /api/auth).
 */
export function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const payload = verifyUserToken(auth.slice(7));
  if (!payload || !payload.sub || !mongoose.isValidObjectId(payload.sub)) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  req.userId = payload.sub;
  next();
}
