import { Shopkeeper } from '../models/Shopkeeper.js';
import { hashPassword, verifyPassword } from '../utils/password.js';

function publicShopkeeper(doc) {
  if (!doc) return null;
  const o = doc.toObject ? doc.toObject({ getters: true }) : { ...doc };
  delete o.password;
  return o;
}

export async function register(req, res) {
  try {
    const { name, email, password, shopName, shopAddress, phone, licenseOrGst } = req.body || {};
    if (!name || !email || !password || !shopName) {
      return res.status(400).json({ error: 'name, email, password, and shopName are required' });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    const pwd = hashPassword(password);
    const doc = await Shopkeeper.create({
      name: String(name).trim(),
      email: String(email).trim().toLowerCase(),
      password: pwd,
      shopName: String(shopName).trim(),
      shopAddress: shopAddress != null ? String(shopAddress).trim() : '',
      phone: phone != null ? String(phone).trim() : '',
      licenseOrGst: licenseOrGst != null ? String(licenseOrGst).trim() : '',
    });
    res.status(201).json({ shopkeeper: publicShopkeeper(doc) });
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
    const doc = await Shopkeeper.findOne({ email: String(email).trim().toLowerCase() }).select('+password');
    if (!doc || !verifyPassword(password, doc.password)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    res.json({ shopkeeper: publicShopkeeper(doc) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
}
