import { KitchenState, defaultSustainability } from '../models/KitchenState.js';

const defaultPayload = {
  pantryItems: [],
  shoppingList: [],
  notifications: 0,
  userName: 'User',
  userInitials: 'U',
  notifData: [],
  sustainability: { ...defaultSustainability },
  claimedDeals: [],
};

function sanitizeUserId(req) {
  const q = req.query.userId ?? req.body?.userId;
  const s = typeof q === 'string' ? q.trim() : '';
  return s || 'default';
}

function stripDoc(doc) {
  const o = doc.toObject();
  delete o._id;
  delete o.__v;
  delete o.createdAt;
  delete o.updatedAt;
  return o;
}

export async function getKitchenData(req, res) {
  try {
    const userId = sanitizeUserId(req);
    let doc = await KitchenState.findOne({ userId });
    if (!doc && userId === 'default') {
      doc = await KitchenState.findOne({ key: 'default' });
      if (doc && (doc.userId == null || doc.userId === '')) {
        doc.userId = 'default';
        await doc.save();
      }
    }
    if (!doc) {
      doc = await KitchenState.create({ userId, key: 'default', ...defaultPayload });
    }
    if (!doc.sustainability || typeof doc.sustainability !== 'object') {
      doc.sustainability = { ...defaultSustainability };
      await doc.save();
    }
    if (!Array.isArray(doc.claimedDeals)) {
      doc.claimedDeals = [];
      await doc.save();
    }
    const o = stripDoc(doc);
    delete o.key;
    res.json(o);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load data' });
  }
}

export async function saveKitchenData(req, res) {
  try {
    const userId = sanitizeUserId(req);
    const body = req.body || {};
    const allowed = [
      'pantryItems',
      'shoppingList',
      'notifications',
      'userName',
      'userInitials',
      'notifData',
      'sustainability',
      'claimedDeals',
    ];
    const $set = {};
    for (const k of allowed) {
      if (body[k] !== undefined) $set[k] = body[k];
    }
    $set.userId = userId;
    $set.key = 'default';

    await KitchenState.findOneAndUpdate({ userId }, { $set }, { upsert: true, new: true, setDefaultsOnInsert: true });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save data' });
  }
}

/**
 * Merge anonymous kitchen state into account-linked userId (e.g. after profile save).
 */
export async function migrateKitchenData(req, res) {
  try {
    const { fromUserId, toUserId } = req.body || {};
    if (!fromUserId || !toUserId || typeof fromUserId !== 'string' || typeof toUserId !== 'string') {
      return res.status(400).json({ error: 'fromUserId and toUserId are required' });
    }
    if (fromUserId === toUserId) {
      return res.json({ success: true, migrated: false });
    }

    const fromDoc = await KitchenState.findOne({ userId: fromUserId.trim() });
    const toDoc = await KitchenState.findOne({ userId: toUserId.trim() });

    if (!fromDoc) {
      return res.json({ success: true, migrated: false });
    }

    if (!toDoc) {
      fromDoc.userId = toUserId.trim();
      await fromDoc.save();
      return res.json({ success: true, migrated: true, action: 'renamed' });
    }

    const merged = {
      pantryItems: [...(toDoc.pantryItems || []), ...(fromDoc.pantryItems || [])],
      shoppingList: [...(toDoc.shoppingList || []), ...(fromDoc.shoppingList || [])],
      notifications: Math.max(Number(toDoc.notifications) || 0, Number(fromDoc.notifications) || 0),
      notifData: [...(toDoc.notifData || []), ...(fromDoc.notifData || [])].slice(-50),
      sustainability: {
        ...defaultSustainability,
        ...(fromDoc.sustainability || {}),
        ...(toDoc.sustainability || {}),
        itemsConsumedBeforeExpiry:
          (Number(toDoc.sustainability?.itemsConsumedBeforeExpiry) || 0) +
          (Number(fromDoc.sustainability?.itemsConsumedBeforeExpiry) || 0),
        dealsClaimed:
          (Number(toDoc.sustainability?.dealsClaimed) || 0) +
          (Number(fromDoc.sustainability?.dealsClaimed) || 0),
        kgFoodWasteAvoided:
          (Number(toDoc.sustainability?.kgFoodWasteAvoided) || 0) +
          (Number(fromDoc.sustainability?.kgFoodWasteAvoided) || 0),
        co2KgSaved:
          (Number(toDoc.sustainability?.co2KgSaved) || 0) +
          (Number(fromDoc.sustainability?.co2KgSaved) || 0),
        plasticItemsAvoided:
          (Number(toDoc.sustainability?.plasticItemsAvoided) || 0) +
          (Number(fromDoc.sustainability?.plasticItemsAvoided) || 0),
        recipesCooked:
          (Number(toDoc.sustainability?.recipesCooked) || 0) +
          (Number(fromDoc.sustainability?.recipesCooked) || 0),
      },
      claimedDeals: [...(toDoc.claimedDeals || []), ...(fromDoc.claimedDeals || [])],
    };

    toDoc.set(merged);
    await toDoc.save();
    await KitchenState.deleteOne({ _id: fromDoc._id });
    res.json({ success: true, migrated: true, action: 'merged' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to migrate data' });
  }
}
