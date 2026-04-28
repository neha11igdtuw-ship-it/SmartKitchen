import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'smartkitchen-dev-secret-change-in-production';
/** Default session length (e.g. 30d). Use “Keep me signed in” for longer. */
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '30d';
const JWT_EXPIRES_IN_REMEMBER = process.env.JWT_EXPIRES_IN_REMEMBER || '90d';

/**
 * @param {string} userId
 * @param {boolean} [rememberMe] — longer-lived token (shopping-app style “stay logged in”)
 */
export function signUserToken(userId, rememberMe = false) {
  const expiresIn = rememberMe ? JWT_EXPIRES_IN_REMEMBER : JWT_EXPIRES_IN;
  return jwt.sign({ sub: String(userId) }, JWT_SECRET, { expiresIn });
}

export function verifyUserToken(token) {
  try {
    return jwt.verify(String(token), JWT_SECRET);
  } catch {
    return null;
  }
}
