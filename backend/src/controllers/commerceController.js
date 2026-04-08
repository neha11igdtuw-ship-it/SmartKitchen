import mongoose from 'mongoose';
import { CommerceProfile } from '../models/CommerceProfile.js';
import { CommercePurchase } from '../models/CommercePurchase.js';

function invalidId(res) {
  return res.status(400).json({ error: 'Invalid id' });
}

export async function listProfiles(req, res) {
  try {
    const uid = req.userId;
    const items = await CommerceProfile.find({ userId: uid }).sort({ updatedAt: -1 }).lean();
    res.json(items.map((p) => ({ ...p, id: String(p._id) })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list profiles' });
  }
}

export async function createProfile(req, res) {
  try {
    const { platform, label, notes } = req.body || {};
    if (!platform || !String(platform).trim()) {
      return res.status(400).json({ error: 'platform is required' });
    }
    const doc = await CommerceProfile.create({
      userId: req.userId,
      platform: String(platform).trim(),
      label: label != null ? String(label).trim() : '',
      notes: notes != null ? String(notes).trim() : '',
    });
    const o = doc.toObject();
    res.status(201).json({ ...o, id: String(o._id) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create profile' });
  }
}

export async function deleteProfile(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return invalidId(res);
    const del = await CommerceProfile.findOneAndDelete({ _id: id, userId: req.userId });
    if (!del) return res.status(404).json({ error: 'Profile not found' });
    await CommercePurchase.deleteMany({ userId: req.userId, commerceProfileId: id });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete profile' });
  }
}

export async function listPurchases(req, res) {
  try {
    const { platform, category, limit = '100', from, to } = req.query;
    const q = { userId: req.userId };
    if (platform) q.platform = new RegExp(String(platform).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    if (category) q.category = String(category);
    if (from || to) {
      q.purchasedAt = {};
      if (from) q.purchasedAt.$gte = new Date(from);
      if (to) q.purchasedAt.$lte = new Date(to);
    }
    const lim = Math.min(500, Math.max(1, parseInt(limit, 10) || 100));
    const items = await CommercePurchase.find(q)
      .sort({ purchasedAt: -1 })
      .limit(lim)
      .lean();
    res.json(
      items.map((p) => ({
        ...p,
        id: String(p._id),
        userId: String(p.userId),
        commerceProfileId: p.commerceProfileId ? String(p.commerceProfileId) : null,
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list purchases' });
  }
}

export async function createPurchase(req, res) {
  try {
    const {
      platform,
      commerceProfileId,
      purchasedAt,
      itemName,
      category,
      quantity,
      unit,
      amountInr,
    } = req.body || {};
    if (!platform || !String(platform).trim()) {
      return res.status(400).json({ error: 'platform is required' });
    }
    if (!itemName || !String(itemName).trim()) {
      return res.status(400).json({ error: 'itemName is required' });
    }
    if (!category || !String(category).trim()) {
      return res.status(400).json({ error: 'category is required' });
    }
    const at = purchasedAt ? new Date(purchasedAt) : new Date();
    if (Number.isNaN(at.getTime())) {
      return res.status(400).json({ error: 'Invalid purchasedAt' });
    }
    let profileId = null;
    if (commerceProfileId && mongoose.isValidObjectId(commerceProfileId)) {
      const prof = await CommerceProfile.findOne({ _id: commerceProfileId, userId: req.userId }).lean();
      if (!prof) return res.status(400).json({ error: 'Invalid commerceProfileId' });
      profileId = prof._id;
    }
    const q = quantity != null && !Number.isNaN(Number(quantity)) ? Number(quantity) : 1;
    let amt;
    if (amountInr != null && amountInr !== '' && !Number.isNaN(Number(amountInr))) {
      amt = Math.max(0, Number(amountInr));
    }
    const doc = await CommercePurchase.create({
      userId: req.userId,
      commerceProfileId: profileId,
      platform: String(platform).trim(),
      purchasedAt: at,
      itemName: String(itemName).trim(),
      category: String(category).trim(),
      quantity: q,
      unit: unit != null ? String(unit).trim() : 'units',
      amountInr: amt,
      source: 'manual',
    });
    const o = doc.toObject();
    res.status(201).json({
      ...o,
      id: String(o._id),
      userId: String(o.userId),
      commerceProfileId: o.commerceProfileId ? String(o.commerceProfileId) : null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create purchase' });
  }
}

export async function deletePurchase(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return invalidId(res);
    const del = await CommercePurchase.findOneAndDelete({ _id: id, userId: req.userId });
    if (!del) return res.status(404).json({ error: 'Purchase not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete purchase' });
  }
}

function hourBucket(h) {
  if (h >= 6 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 21) return 'evening';
  return 'night';
}

export async function getAnalytics(req, res) {
  try {
    const uid = new mongoose.Types.ObjectId(req.userId);
    const match = { userId: uid };

    const [totalCount, amountAgg, byCategory, byPlatform, byMonth, profiles] = await Promise.all([
      CommercePurchase.countDocuments(match),
      CommercePurchase.aggregate([
        { $match: match },
        { $group: { _id: null, total: { $sum: { $ifNull: ['$amountInr', 0] } } } },
      ]),
      CommercePurchase.aggregate([
        { $match: match },
        { $group: { _id: '$category', count: { $sum: 1 }, amountInr: { $sum: { $ifNull: ['$amountInr', 0] } } } },
        { $sort: { count: -1 } },
      ]),
      CommercePurchase.aggregate([
        { $match: match },
        { $group: { _id: '$platform', count: { $sum: 1 }, amountInr: { $sum: { $ifNull: ['$amountInr', 0] } } } },
        { $sort: { count: -1 } },
      ]),
      CommercePurchase.aggregate([
        { $match: match },
        {
          $group: {
            _id: {
              y: { $year: '$purchasedAt' },
              m: { $month: '$purchasedAt' },
            },
            count: { $sum: 1 },
            amountInr: { $sum: { $ifNull: ['$amountInr', 0] } },
          },
        },
        { $sort: { '_id.y': 1, '_id.m': 1 } },
        { $limit: 24 },
      ]),
      CommerceProfile.find({ userId: req.userId }).lean(),
    ]);

    const purchases = await CommercePurchase.find(match)
      .select({ purchasedAt: 1 })
      .sort({ purchasedAt: 1 })
      .lean();

    const hourBuckets = { morning: 0, afternoon: 0, evening: 0, night: 0 };
    const hourHistogram = Array(24).fill(0);
    let lastDate = null;
    let sumGapDays = 0;
    let gapCount = 0;

    purchases.forEach((p) => {
      const d = new Date(p.purchasedAt);
      const h = d.getUTCHours();
      hourHistogram[h] += 1;
      hourBuckets[hourBucket(h)] += 1;
      if (lastDate) {
        const diff = (d - lastDate) / 86400000;
        if (diff > 0) {
          sumGapDays += diff;
          gapCount += 1;
        }
      }
      lastDate = d;
    });

    const dateBounds = await CommercePurchase.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          first: { $min: '$purchasedAt' },
          last: { $max: '$purchasedAt' },
        },
      },
    ]);

    const totalAmountInr = amountAgg[0]?.total || 0;
    const bounds = dateBounds[0] || {};

    res.json({
      summary: {
        totalPurchases: totalCount,
        totalAmountInr: Math.round(totalAmountInr * 100) / 100,
        firstPurchaseAt: bounds.first || null,
        lastPurchaseAt: bounds.last || null,
        avgDaysBetweenOrders: gapCount > 0 ? Math.round((sumGapDays / gapCount) * 10) / 10 : null,
      },
      byCategory: byCategory.map((r) => ({
        category: r._id || 'Unknown',
        count: r.count,
        amountInr: Math.round(r.amountInr * 100) / 100,
      })),
      byPlatform: byPlatform.map((r) => ({
        platform: r._id || 'Unknown',
        count: r.count,
        amountInr: Math.round(r.amountInr * 100) / 100,
      })),
      byMonth: byMonth.map((r) => ({
        month: `${r._id.y}-${String(r._id.m).padStart(2, '0')}`,
        count: r.count,
        amountInr: Math.round(r.amountInr * 100) / 100,
      })),
      purchaseTimeUTC: {
        hourHistogram,
        buckets: hourBuckets,
        note: 'Times use UTC. Log purchases with local order time for best accuracy.',
      },
      linkedProfiles: profiles.map((p) => ({ ...p, id: String(p._id) })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to compute analytics' });
  }
}
