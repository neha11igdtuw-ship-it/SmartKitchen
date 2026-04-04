import mongoose from 'mongoose';
import { Deal } from '../models/Deal.js';
import { Shopkeeper } from '../models/Shopkeeper.js';
import { KitchenState, defaultSustainability } from '../models/KitchenState.js';

function parseQueryInt(v, fallback, max) {
  const n = parseInt(v, 10);
  if (Number.isNaN(n) || n < 0) return fallback;
  return Math.min(n, max);
}

export async function listDeals(req, res) {
  try {
    const limit = parseQueryInt(req.query.limit, 200, 500);
    const skip = parseQueryInt(req.query.skip, 0, 100_000);
    const shopName = req.query.shopName != null ? String(req.query.shopName).trim() : '';
    const expiringBefore = req.query.expiringBefore;
    const shopkeeperId = req.query.shopkeeperId;

    const filter = {};
    if (shopkeeperId && mongoose.isValidObjectId(shopkeeperId)) {
      filter.shopkeeperId = shopkeeperId;
    }
    if (shopName) {
      filter.shopName = new RegExp(shopName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    }
    if (expiringBefore) {
      const d = new Date(expiringBefore);
      if (!Number.isNaN(d.getTime())) {
        filter.expiryDate = { $lte: d };
      }
    }

    const [items, total] = await Promise.all([
      Deal.find(filter).sort({ expiryDate: 1 }).skip(skip).limit(limit).lean(),
      Deal.countDocuments(filter),
    ]);

    res.json({
      items,
      total,
      skip,
      limit,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list deals' });
  }
}

export async function createDeal(req, res) {
  try {
    const {
      productName,
      quantity,
      expiryDate,
      discountPrice,
      originalPrice,
      shopName,
      location,
      shopkeeperId,
    } = req.body || {};

    if (!productName || !quantity || !expiryDate || discountPrice == null || !shopName) {
      return res.status(400).json({
        error: 'productName, quantity, expiryDate, discountPrice, and shopName are required',
      });
    }

    const exp = new Date(expiryDate);
    if (Number.isNaN(exp.getTime())) {
      return res.status(400).json({ error: 'expiryDate must be a valid date' });
    }

    const price = Number(discountPrice);
    if (Number.isNaN(price) || price < 0) {
      return res.status(400).json({ error: 'discountPrice must be a non-negative number' });
    }

    let orig;
    if (originalPrice != null && originalPrice !== '') {
      orig = Number(originalPrice);
      if (Number.isNaN(orig) || orig < 0) {
        return res.status(400).json({ error: 'originalPrice must be a non-negative number' });
      }
    }

    let skRef = null;
    if (shopkeeperId != null && shopkeeperId !== '') {
      if (!mongoose.isValidObjectId(shopkeeperId)) {
        return res.status(400).json({ error: 'Invalid shopkeeperId' });
      }
      const sk = await Shopkeeper.findById(shopkeeperId).lean();
      if (!sk) {
        return res.status(400).json({ error: 'Shopkeeper not found' });
      }
      skRef = sk._id;
    }

    const doc = await Deal.create({
      productName: String(productName).trim(),
      quantity: String(quantity).trim(),
      expiryDate: exp,
      discountPrice: price,
      originalPrice: orig,
      shopName: String(shopName).trim(),
      location: location != null ? String(location).trim() : '',
      shopkeeperId: skRef,
    });
    res.status(201).json(doc);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create deal' });
  }
}

function kitchenDocFilter(userId) {
  if (userId === 'default') {
    return {
      $or: [
        { userId: 'default' },
        { userId: { $exists: false } },
        { userId: null },
        { userId: '' },
      ],
      key: 'default',
    };
  }
  return { userId };
}

export async function claimDeal(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid deal id' });
    }

    const userId = String(req.body?.userId ?? 'default').trim() || 'default';
    const deal = await Deal.findById(id).lean();
    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    let doc = await KitchenState.findOne(kitchenDocFilter(userId));
    if (!doc) {
      doc = await KitchenState.create({
        userId,
        key: 'default',
        pantryItems: [],
        shoppingList: [],
        sustainability: { ...defaultSustainability },
        claimedDeals: [],
      });
    } else if (!doc.userId || doc.userId === '') {
      doc.userId = userId;
      await doc.save();
    }

    const claimed = Array.isArray(doc.claimedDeals) ? doc.claimedDeals : [];
    if (claimed.some((c) => c && String(c.dealId) === String(id))) {
      return res.json({ success: true, alreadyClaimed: true, sustainability: doc.sustainability });
    }

    const claimedAt = new Date().toISOString();
    const estKg = 0.35;
    const estCo2 = estKg * 2.5;

    const sus = {
      ...defaultSustainability,
      ...(doc.sustainability && typeof doc.sustainability === 'object' ? doc.sustainability : {}),
    };
    sus.dealsClaimed = (Number(sus.dealsClaimed) || 0) + 1;
    sus.kgFoodWasteAvoided = (Number(sus.kgFoodWasteAvoided) || 0) + estKg;
    sus.co2KgSaved = (Number(sus.co2KgSaved) || 0) + estCo2;

    await KitchenState.findOneAndUpdate(
      { _id: doc._id },
      {
        $push: { claimedDeals: { dealId: String(id), claimedAt, productName: deal.productName } },
        $set: { sustainability: sus, userId, key: 'default' },
      },
      { new: true }
    );

    const updated = await KitchenState.findById(doc._id).lean();
    return res.json({
      success: true,
      alreadyClaimed: false,
      sustainability: updated?.sustainability || sus,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to record claim' });
  }
}
