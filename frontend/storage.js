/* ============================================================
   SMART KITCHEN – Persistence Layer (local + optional API sync)
   ============================================================ */

const defaultSustainability = {
  itemsConsumedBeforeExpiry: 0,
  dealsClaimed: 0,
  kgFoodWasteAvoided: 0,
  co2KgSaved: 0,
  plasticItemsAvoided: 0,
  recipesCooked: 0,
};

const KitchenStore = {
  _key: 'smart_kitchen_data',

  defaults: {
    pantryItems: [],
    shoppingList: [],
    notifications: 0,
    userName: '',
    userInitials: '',
    notifData: [],
    sustainability: { ...defaultSustainability },
    claimedDeals: [],
  },

  getData() {
    const saved = localStorage.getItem(this._key);
    let data;
    if (!saved) {
      data = JSON.parse(JSON.stringify(this.defaults));
      this._persist(data);
      return data;
    }
    data = JSON.parse(saved);

    if (!data.sustainability || typeof data.sustainability !== 'object') {
      data.sustainability = { ...defaultSustainability };
    }
    if (!Array.isArray(data.claimedDeals)) data.claimedDeals = [];

    const legacyPantry = localStorage.getItem('sk_pantry');
    if (legacyPantry && (!data.pantryItems || data.pantryItems.length === 0)) {
      try {
        data.pantryItems = JSON.parse(legacyPantry);
      } catch (_) {}
    }
    const legacyShop = localStorage.getItem('sk_shop');
    if (legacyShop && (!data.shoppingList || data.shoppingList.length === 0)) {
      try {
        data.shoppingList = JSON.parse(legacyShop);
      } catch (_) {}
    }

    return data;
  },

  _persist(data) {
    localStorage.setItem(this._key, JSON.stringify(data));
  },

  saveData(data) {
    this._persist(data);
  },

  addItem(collection, item) {
    const data = this.getData();
    if (!data[collection]) data[collection] = [];
    data[collection].push(item);
    this.saveData(data);
    return item;
  },

  updateItem(collection, id, updates) {
    const data = this.getData();
    if (!data[collection]) return null;
    const index = data[collection].findIndex(i => i.id === id);
    if (index === -1) return null;
    data[collection][index] = { ...data[collection][index], ...updates };
    this.saveData(data);
    return data[collection][index];
  },

  removeItem(collection, id) {
    const data = this.getData();
    if (!data[collection]) return false;
    data[collection] = data[collection].filter(i => i.id !== id);
    this.saveData(data);
    return true;
  },

  clearAll() {
    localStorage.removeItem(this._key);
  }
};

window.KitchenStore = KitchenStore;
window.defaultSustainability = defaultSustainability;
