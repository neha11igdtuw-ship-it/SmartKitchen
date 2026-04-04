/* ============================================================
   Client-side match: pantry expiry ↔ deals ↔ recipe ingredients
   ============================================================ */

(function (global) {
  function tokenize(str) {
    return String(str || '')
      .toLowerCase()
      .replace(/[^a-z0-9\u00C0-\u024F]+/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2);
  }

  function pantryExpiryDays(item) {
    if (!item || !item.expires) return 999;
    const parts = String(item.expires).split('/');
    if (parts.length !== 3) return 999;
    const d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
    return Math.ceil((d - new Date()) / 86400000);
  }

  function pantryTokenSet(pantryItems) {
    const set = new Set();
    (pantryItems || []).forEach((i) => {
      tokenize(i.name).forEach((t) => set.add(t));
    });
    return set;
  }

  function scoreRecipeAgainstPantry(recipe, pantryItems) {
    const tokens = pantryTokenSet(pantryItems);
    const words = [];
    (recipe.ingredients || []).forEach((line) => {
      tokenize(line).forEach((w) => words.push(w));
    });
    const matched = [];
    let hits = 0;
    words.forEach((w) => {
      if (tokens.has(w)) {
        hits++;
        if (!matched.includes(w)) matched.push(w);
      }
    });
    const expiring = (pantryItems || []).map(pantryExpiryDays).filter((d) => d >= 0);
    const minDays = expiring.length ? Math.min(...expiring) : 999;
    const urgencyBonus = minDays <= 3 ? 0.5 : 0;
    return { score: hits + urgencyBonus, matched, minDays };
  }

  function matchDealToPantry(dealName, pantryItems) {
    const tokens = pantryTokenSet(pantryItems);
    const dn = tokenize(dealName);
    let hits = 0;
    dn.forEach((w) => {
      if (tokens.has(w)) hits++;
    });
    return hits;
  }

  function expiringSoon(items, withinDays) {
    return (items || []).filter((i) => {
      const d = pantryExpiryDays(i);
      return d <= withinDays && d >= 0;
    });
  }

  global.KitchenMatch = {
    tokenize,
    pantryExpiryDays,
    scoreRecipeAgainstPantry,
    matchDealToPantry,
    expiringSoon,
  };
})(typeof window !== 'undefined' ? window : globalThis);
