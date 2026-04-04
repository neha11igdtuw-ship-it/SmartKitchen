/* ============================================================
   Kitchen ↔ /api/data sync (per getKitchenUserId)
   Load after storage.js; initKitchenSync before reading live AppState.
   ============================================================ */

(function () {
  const API = '/api';
  let _debounce;
  let syncingFromServer = false;

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
      const serverHas =
        (server.pantryItems && server.pantryItems.length > 0) ||
        (server.shoppingList && server.shoppingList.length > 0);
      const localHas =
        (local.pantryItems && local.pantryItems.length > 0) ||
        (local.shoppingList && local.shoppingList.length > 0);

      syncingFromServer = true;
      if (serverHas || !localHas) {
        const merged = {
          ...local,
          ...server,
          pantryItems: server.pantryItems || [],
          shoppingList: server.shoppingList || [],
          notifData: server.notifData != null ? server.notifData : local.notifData,
          notifications:
            server.notifications != null ? server.notifications : local.notifications,
          sustainability: {
            ...(local.sustainability || {}),
            ...(server.sustainability || {}),
          },
          claimedDeals: server.claimedDeals || local.claimedDeals || [],
        };
        if (!merged.userName && local.userName) merged.userName = local.userName;
        if (!merged.userInitials && local.userInitials) merged.userInitials = local.userInitials;
        origPersist(merged);
      } else if (localHas) {
        syncingFromServer = false;
        await syncPush();
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
          ...server,
          pantryItems: server.pantryItems || [],
          shoppingList: server.shoppingList || [],
          notifData: server.notifData != null ? server.notifData : local.notifData,
          notifications:
            server.notifications != null ? server.notifications : local.notifications,
          sustainability: { ...(local.sustainability || {}), ...(server.sustainability || {}) },
          claimedDeals: server.claimedDeals || local.claimedDeals || [],
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
