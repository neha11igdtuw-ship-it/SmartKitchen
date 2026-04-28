/* ============================================================
   Kitchen ↔ /api/data sync (per getKitchenUserId)
   Load after storage.js; initKitchenSync before reading live AppState.
   ============================================================ */

(function () {
  const API = '/api';
  let _debounce;
  let syncingFromServer = false;

  function pantryMergeKey(it) {
    if (it == null) return '';
    if (it.id != null && it.id !== '') return `id:${String(it.id)}`;
    return `n:${String(it.name || '')}:${String(it.expires || '')}`;
  }

  function mergePantryItems(serverItems, localItems) {
    const s = Array.isArray(serverItems) ? serverItems : [];
    const l = Array.isArray(localItems) ? localItems : [];
    if (l.length === 0) return s.slice();
    if (s.length === 0) return l.slice();
    const map = new Map();
    for (const it of s) map.set(pantryMergeKey(it), it);
    for (const it of l) {
      const k = pantryMergeKey(it);
      if (!map.has(k)) map.set(k, it);
    }
    return Array.from(map.values());
  }

  function mergeShoppingLists(serverList, localList) {
    const s = Array.isArray(serverList) ? serverList : [];
    const l = Array.isArray(localList) ? localList : [];
    if (l.length === 0) return s.slice();
    if (s.length === 0) return l.slice();
    const key = (x) => (typeof x === 'string' ? `s:${x}` : `o:${JSON.stringify(x)}`);
    const seen = new Set();
    const out = [];
    for (const x of s) {
      const k = key(x);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(x);
    }
    for (const x of l) {
      const k = key(x);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(x);
    }
    return out;
  }

  function mergeClaimedDeals(serverList, localList) {
    const s = Array.isArray(serverList) ? serverList : [];
    const l = Array.isArray(localList) ? localList : [];
    if (l.length === 0) return s.slice();
    if (s.length === 0) return l.slice();
    const seen = new Set(s.map((x) => JSON.stringify(x)));
    const out = s.slice();
    for (const x of l) {
      const k = JSON.stringify(x);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(x);
    }
    return out;
  }

  function getKitchenUserId() {
    const mongo = localStorage.getItem('sk_profile_user_id');
    if (mongo) return mongo;
    let kid = localStorage.getItem('sk_kitchen_user_id');
    if (!kid) {
      kid =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `dev_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      localStorage.setItem('sk_kitchen_user_id', kid);
    }
    return kid;
  }

  async function syncPull() {
    const userId = getKitchenUserId();
    const r = await fetch(`${API}/data?userId=${encodeURIComponent(userId)}`);
    if (!r.ok) throw new Error('sync pull failed');
    return r.json();
  }

  async function syncPush() {
    if (typeof KitchenStore === 'undefined') return;
    const userId = getKitchenUserId();
    const payload = KitchenStore.getData();
    payload.userId = userId;
    const r = await fetch(`${API}/data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!r.ok) throw new Error('sync push failed');
  }

  async function migrateKitchenUser(fromUserId, toUserId) {
    if (!fromUserId || !toUserId || fromUserId === toUserId) return;
    const r = await fetch(`${API}/data/migrate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromUserId, toUserId }),
    });
    if (!r.ok) return;
    localStorage.setItem('sk_kitchen_user_id', toUserId);
  }

  let _syncPromise = null;

  async function initKitchenSync() {
    if (typeof KitchenStore === 'undefined') return;
    if (_syncPromise) return _syncPromise;

    _syncPromise = (async () => {
    const origPersist = KitchenStore._persist.bind(KitchenStore);
    if (!KitchenStore._syncWrapped) {
      KitchenStore._syncWrapped = true;
      KitchenStore.saveData = function (data) {
        origPersist(data);
        if (syncingFromServer) return;
        clearTimeout(_debounce);
        _debounce = setTimeout(() => {
          syncPush().catch(() => {});
        }, 800);
      };
    }

    try {
      const server = await syncPull();
      const local = KitchenStore.getData();

      const merged = {
        ...local,
        userName: server.userName || local.userName || '',
        userInitials: server.userInitials || local.userInitials || '',
        pantryItems: mergePantryItems(server.pantryItems, local.pantryItems),
        shoppingList: mergeShoppingLists(server.shoppingList, local.shoppingList),
        notifications: Math.max(
          Number(server.notifications) || 0,
          Number(local.notifications) || 0
        ),
        notifData:
          Array.isArray(server.notifData) && server.notifData.length
            ? server.notifData
            : local.notifData,
        sustainability: {
          ...(local.sustainability || {}),
          ...(server.sustainability || {}),
        },
        claimedDeals: mergeClaimedDeals(server.claimedDeals, local.claimedDeals),
      };

      syncingFromServer = true;
      origPersist(merged);
      syncingFromServer = false;

      try {
        await syncPush();
      } catch (pushErr) {
        console.warn('Kitchen sync push:', pushErr);
      }
    } catch (e) {
      console.warn('Kitchen sync:', e);
    } finally {
      syncingFromServer = false;
    }
    })();
    return _syncPromise;
  }

  async function kitchenSyncReload() {
    try {
      const server = await syncPull();
      const local = KitchenStore.getData();
      syncingFromServer = true;
      try {
        const merged = {
          ...local,
          userName: server.userName || local.userName || '',
          userInitials: server.userInitials || local.userInitials || '',
          pantryItems: mergePantryItems(server.pantryItems, local.pantryItems),
          shoppingList: mergeShoppingLists(server.shoppingList, local.shoppingList),
          notifications: Math.max(
            Number(server.notifications) || 0,
            Number(local.notifications) || 0
          ),
          notifData:
            Array.isArray(server.notifData) && server.notifData.length
              ? server.notifData
              : local.notifData,
          sustainability: { ...(local.sustainability || {}), ...(server.sustainability || {}) },
          claimedDeals: mergeClaimedDeals(server.claimedDeals, local.claimedDeals),
        };
        KitchenStore._persist(merged);
      } finally {
        syncingFromServer = false;
      }
    } catch (e) {
      console.warn('kitchenSyncReload', e);
    }
  }

  window.getKitchenUserId = getKitchenUserId;
  window.syncPush = syncPush;
  window.initKitchenSync = initKitchenSync;
  window.migrateKitchenUser = migrateKitchenUser;
  window.kitchenSyncReload = kitchenSyncReload;
})();
