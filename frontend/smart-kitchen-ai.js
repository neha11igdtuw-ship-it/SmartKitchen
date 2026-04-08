/* ============================================================
   SmartKitchen AI – behavior & usage patterns → predictions
   Client-side: CO₂e / waste / savings, shopping optimization,
   category-based expiry risk. No external API required.
   ============================================================ */

(function (global) {
  const USAGE_KEY = 'sk_ai_usage_v2';

  const signals = global.KitchenSignals;
  const CATEGORY_SHELF_DAYS = {
    Bakery: 5,
    Produce: 7,
    Dairy: 14,
    Grains: 120,
    Pantry: 90,
    ...(signals && signals.categoryShelfDays ? signals.categoryShelfDays : {}),
  };

  function tokenizeName(name) {
    if (typeof global.KitchenMatch !== 'undefined' && global.KitchenMatch.tokenize) {
      return global.KitchenMatch.tokenize(name);
    }
    return String(name || '')
      .toLowerCase()
      .replace(/[^a-z0-9\u00C0-\u024F]+/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2);
  }

  function getKeywordShelfDays(item) {
    const rules = signals && signals.keywordShelfDays;
    if (!rules || !item) return null;
    const lower = String(item.name || '').toLowerCase();
    const tokens = new Set(tokenizeName(item.name));
    for (let r = 0; r < rules.length; r++) {
      const rule = rules[r];
      if (!rule.k || rule.days == null) continue;
      for (let k = 0; k < rule.k.length; k++) {
        const kw = String(rule.k[k]).toLowerCase();
        if (tokens.has(kw) || lower.includes(kw)) return rule.days;
      }
    }
    return null;
  }

  function getShelfBaselineDays(item) {
    if (!item) return 45;
    const kw = getKeywordShelfDays(item);
    if (kw != null) return kw;
    const cat = item.cat || 'Pantry';
    return CATEGORY_SHELF_DAYS[cat] ?? 45;
  }

  function pantryDietCarbonIntensity(pantryItems) {
    const factors = signals && signals.co2eKgPerKgByCategory;
    if (!factors) return 0;
    let sum = 0;
    let c = 0;
    (pantryItems || []).forEach((i) => {
      const cat = i.cat || 'Pantry';
      const f = factors[cat];
      if (f != null) {
        sum += f;
        c++;
      }
    });
    if (!c) return 0;
    return sum / c;
  }

  function getShoppingPairSuggestions(pantryItems, shoppingList, existingOut) {
    const pairs = signals && signals.shoppingPairs;
    if (!pairs || !pairs.length) return [];
    const names = new Set((shoppingList || []).map((x) => String(x.name).toLowerCase().trim()));
    (existingOut || []).forEach((o) => names.add(String(o.name).toLowerCase().trim()));
    const allTokens = new Set();
    (pantryItems || []).forEach((i) => {
      tokenizeName(i.name).forEach((t) => allTokens.add(t));
    });
    (shoppingList || []).forEach((i) => {
      tokenizeName(i.name).forEach((t) => allTokens.add(t));
    });
    const out = [];
    for (let p = 0; p < pairs.length; p++) {
      const pair = pairs[p];
      if (!pair.has || !pair.suggest) continue;
      const hasHit = pair.has.some((h) => {
        const ht = String(h).toLowerCase();
        if (allTokens.has(ht)) return true;
        return [...allTokens].some((t) => t.includes(ht) || ht.includes(t));
      });
      if (!hasHit) continue;
      const sugg = String(pair.suggest).toLowerCase();
      const exists = [...names].some((n) => {
        if (!n || !sugg) return false;
        if (n.includes(sugg) || sugg.includes(n)) return true;
        return sugg.split(/\s+or\s+/).some((part) => {
          const w = part.trim().split(/[^a-z0-9]+/i)[0];
          return w && n.includes(w);
        });
      });
      if (exists) continue;
      out.push({
        name: pair.suggest,
        days: 14,
        priority: 'low',
        reason: pair.reason || 'Pairs well with your list',
        source: 'pair',
      });
      names.add(sugg);
      if (out.length >= 3) break;
    }
    return out;
  }

  function migrateUsage(raw) {
    if (!raw) return null;
    try {
      const o = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return {
        visits: o.visits || 0,
        dailyOpens: o.dailyOpens || {},
        lastVisitDay: o.lastVisitDay || '',
        pageViews: o.pageViews || {},
        kitchenActions: o.kitchenActions || { pantry_save: 0, shopping_update: 0, deal_view: 0 },
        lastCategorySnapshot: o.lastCategorySnapshot || {},
      };
    } catch (_) {
      return null;
    }
  }

  function getUsage() {
    try {
      let raw = localStorage.getItem(USAGE_KEY);
      if (!raw) raw = localStorage.getItem('sk_ai_usage_v1');
      const m = migrateUsage(raw);
      if (m) return m;
    } catch (_) {}
    return {
      visits: 0,
      dailyOpens: {},
      lastVisitDay: '',
      pageViews: {},
      kitchenActions: { pantry_save: 0, shopping_update: 0, deal_view: 0 },
      lastCategorySnapshot: {},
    };
  }

  function saveUsage(u) {
    try {
      localStorage.setItem(USAGE_KEY, JSON.stringify(u));
    } catch (_) {}
  }

  function recordVisit() {
    const u = getUsage();
    u.visits = (u.visits || 0) + 1;
    const today = new Date().toISOString().slice(0, 10);
    u.dailyOpens[today] = (u.dailyOpens[today] || 0) + 1;
    u.lastVisitDay = today;
    saveUsage(u);
  }

  function recordPageView(pageFile) {
    const u = getUsage();
    const key = pageFile || 'unknown';
    u.pageViews[key] = (u.pageViews[key] || 0) + 1;
    saveUsage(u);
  }

  function recordKitchenAction(action) {
    const u = getUsage();
    if (!u.kitchenActions) u.kitchenActions = { pantry_save: 0, shopping_update: 0, deal_view: 0 };
    const k = action || 'pantry_save';
    u.kitchenActions[k] = (u.kitchenActions[k] || 0) + 1;
    saveUsage(u);
  }

  function snapshotCategoryMix(pantryItems) {
    const u = getUsage();
    const mix = {};
    (pantryItems || []).forEach((i) => {
      const c = i.cat || 'Pantry';
      mix[c] = (mix[c] || 0) + 1;
    });
    u.lastCategorySnapshot = mix;
    saveUsage(u);
  }

  function pantryExpiryDaysLocal(item) {
    if (!item || !item.expires) return 999;
    const parts = String(item.expires).split('/');
    if (parts.length !== 3) return 999;
    const d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
    if (Number.isNaN(d.getTime())) return 999;
    return Math.ceil((d - new Date()) / 86400000);
  }

  function pantryDaysLeft(item) {
    const d =
      typeof global.KitchenMatch !== 'undefined' && global.KitchenMatch.pantryExpiryDays
        ? global.KitchenMatch.pantryExpiryDays(item)
        : pantryExpiryDaysLocal(item);
    if (d < 999) return d;
    return getShelfBaselineDays(item);
  }

  /**
   * Derive kitchen usage pattern from page views + actions + pantry shape.
   */
  function analyzeBehavior(usage, pantryItems) {
    const u = usage || getUsage();
    const pv = u.pageViews || {};
    const ka = u.kitchenActions || {};
    const totalPV = Object.values(pv).reduce((a, b) => a + b, 0) || 1;
    const pantryPV = (pv['pantry.html'] || 0) + (pv['receipt-scanner.html'] || 0) * 0.5;
    const shopPV = (pv['shopping-list.html'] || 0) + (pv['near-expiry-deals.html'] || 0);
    const dashPV = pv['dashboard.html'] || 0;
    const pantryFocusRatio = Math.min(1, pantryPV / totalPV);
    const shoppingFocusRatio = Math.min(1, shopPV / totalPV);
    const activeDays = Object.keys(u.dailyOpens || {}).length;
    const n = (pantryItems || []).length;
    const perishableRatio =
      n === 0
        ? 0
        : (pantryItems || []).filter((i) => ['Produce', 'Dairy', 'Bakery'].includes(i.cat)).length / n;

    let label = 'Balanced kitchen usage';
    if (pantryFocusRatio > 0.28 && perishableRatio > 0.35) label = 'Inventory-focused — strong tracking of fresh categories';
    else if (shoppingFocusRatio > 0.3) label = 'Deal & list–oriented — savings opportunities weighted higher';
    else if (dashPV / totalPV > 0.35) label = 'Dashboard-first — monitoring expiries and run-outs';

    const actionIntensity = (ka.pantry_save || 0) + (ka.shopping_update || 0) * 0.6;
    const detail = `${activeDays} active day(s) · ${Math.round(pantryFocusRatio * 100)}% pantry/receipt focus · perishables ~${Math.round(perishableRatio * 100)}% of items`;

    return {
      pantryFocusRatio,
      shoppingFocusRatio,
      activeDays,
      perishableRatio,
      actionIntensity,
      label,
      detail,
    };
  }

  /**
   * Predict avoided CO₂e, waste reduction, monthly INR savings from logged activity + behavior.
   */
  function predictFootprintImpact(sustainability, pantryItems, usage) {
    const s = sustainability && typeof sustainability === 'object' ? sustainability : {};
    const kg = Number(s.kgFoodWasteAvoided) || 0;
    const deals = Number(s.dealsClaimed) || 0;
    const recipes = Number(s.recipesCooked) || 0;
    const plastic = Number(s.plasticItemsAvoided) || 0;
    const rawCo2 = Number(s.co2KgSaved) || 0;
    const consumed = Number(s.itemsConsumedBeforeExpiry) || 0;
    const u = usage || getUsage();
    const visits = Math.max(1, u.visits || 1);
    const n = (pantryItems || []).length;
    const behavior = analyzeBehavior(u, pantryItems);

    const visitBoost = 1 + Math.min(0.22, Math.log10(visits + 1) * 0.08);
    const behaviorBoost =
      1 + Math.min(0.12, behavior.activeDays * 0.004) + behavior.pantryFocusRatio * 0.06 + behavior.shoppingFocusRatio * 0.05;
    const usageBoost = visitBoost * behaviorBoost;

    const avgCo2 = pantryDietCarbonIntensity(pantryItems);
    const dietMixBoost = avgCo2 > 0 ? 1 + Math.min(0.18, Math.max(0, avgCo2 - 2) / 80) : 1;

    const CO2_PER_KG_WASTE = 2.5;
    const wasteRelatedCO2 = kg * CO2_PER_KG_WASTE * usageBoost;
    const activityCO2 =
      (deals * 0.35 + recipes * 0.42 + plastic * 0.06 + consumed * 0.05 + n * 0.02) * usageBoost;

    let carbonFootprintKgCO2e =
      rawCo2 > 0 ? rawCo2 * usageBoost : wasteRelatedCO2 + activityCO2;
    carbonFootprintKgCO2e *= dietMixBoost;

    const co2FromWastePreventionKg = rawCo2 > 0 ? Math.min(wasteRelatedCO2, carbonFootprintKgCO2e) : wasteRelatedCO2;
    const co2FromAppActivityKg = Math.max(0, carbonFootprintKgCO2e - co2FromWastePreventionKg * 0.4);

    const wasteReducedKg = (kg + recipes * 0.12 + consumed * 0.03 + deals * 0.02) * usageBoost;

    const baseSavings = deals * 95 + recipes * 45 + plastic * 12 + kg * 80 + consumed * 15 + n * 3;
    const behaviorSavingsBonus = 1 + behavior.shoppingFocusRatio * 0.08 + behavior.pantryFocusRatio * 0.05;
    const monthlySavingsINR = Math.round(Math.min(999999, baseSavings * usageBoost * behaviorSavingsBonus));

    return {
      carbonFootprintKgCO2e: Math.max(0, carbonFootprintKgCO2e),
      co2EmissionsAvoidedKg: Math.max(0, carbonFootprintKgCO2e),
      co2FromWastePreventionKg: Math.max(0, co2FromWastePreventionKg),
      co2FromAppActivityKg: Math.max(0, co2FromAppActivityKg),
      wasteReducedKg: Math.max(0, wasteReducedKg),
      foodWasteReductionKg: Math.max(0, wasteReducedKg),
      monthlySavingsINR,
      usageBoost,
      behaviorPattern: behavior.label,
      behaviorDetail: behavior.detail,
      engagementLabel:
        visits > 25
          ? 'High engagement — predictions favor your logged patterns'
          : 'Forecasts strengthen as you track pantry, lists, and deals',
    };
  }

  function getCategoryExpiryRisk(item) {
    const cat = item.cat || 'Pantry';
    const baseline = getShelfBaselineDays(item);
    const days = pantryDaysLeft(item);
    if (days >= 999) return { level: 'unknown', text: `${cat}: typical shelf ~${baseline}d` };
    const ratio = baseline > 0 ? days / baseline : 1;
    let level = 'ok';
    if (ratio <= 0.2 || days <= 2) level = 'critical';
    else if (ratio <= 0.45 || days <= 5) level = 'high';
    else if (ratio <= 0.7) level = 'medium';
    return {
      level,
      baselineDays: baseline,
      daysLeft: days,
      text: `${cat}: ~${baseline}d typical · ${days}d left (${level})`,
    };
  }

  function getShoppingSuggestions(pantryItems, shoppingList) {
    const names = new Set((shoppingList || []).map((x) => String(x.name).toLowerCase().trim()));
    const scored = (pantryItems || [])
      .map((i) => {
        const days = pantryDaysLeft(i);
        const risk = getCategoryExpiryRisk(i);
        let score = 1000 - days;
        if (risk.level === 'critical') score += 200;
        if (risk.level === 'high') score += 80;
        return { ...i, days, risk, score };
      })
      .filter((i) => i.days <= 10 && i.days >= 0)
      .sort((a, b) => b.score - a.score || a.days - b.days);

    const out = [];
    for (const i of scored) {
      if (out.length >= 6) break;
      const key = String(i.name).toLowerCase().trim();
      if (!names.has(key)) {
        out.push({
          name: i.name,
          days: i.days,
          cat: i.cat || '',
          priority: i.days <= 3 ? 'high' : i.days <= 7 ? 'medium' : 'low',
          reason: i.risk.text,
        });
      }
    }
    if (out.length === 0) {
      (pantryItems || [])
        .filter((i) => i.status === 'urgent')
        .slice(0, 3)
        .forEach((i) =>
          out.push({
            name: i.name,
            days: pantryDaysLeft(i),
            cat: i.cat || '',
            priority: 'high',
            reason: getCategoryExpiryRisk(i).text,
          })
        );
    }
    const pairAdds = getShoppingPairSuggestions(pantryItems, shoppingList, out);
    pairAdds.forEach((p) => {
      if (out.length < 8) out.push(p);
    });
    return out;
  }

  function optimizeShoppingListOrder(suggestions) {
    const order = { high: 0, medium: 1, low: 2 };
    return [...(suggestions || [])].sort((a, b) => {
      const pa = order[a.priority] ?? 1;
      const pb = order[b.priority] ?? 1;
      if (pa !== pb) return pa - pb;
      return (a.days ?? 99) - (b.days ?? 99);
    });
  }

  function getSmartRecommendations(pantryItems) {
    const items = pantryItems || [];
    const recs = [];

    const urgent = items.filter((i) => i.status === 'urgent');
    if (urgent.length) {
      const u = urgent[0];
      const r = getCategoryExpiryRisk(u);
      recs.push({
        priority: 1,
        text: `Priority: use ${u.name} (${r.text}).`,
      });
    }
    const warn = items.filter((i) => i.status === 'warning');
    if (warn.length && recs.length < 8) {
      recs.push({
        priority: 2,
        text: `${warn.length} item(s) in the expiring window — plan meals for ${warn
          .slice(0, 2)
          .map((x) => x.name)
          .join(' & ')}.`,
      });
    }
    const catDays = {};
    items.forEach((i) => {
      const c = i.cat || 'Pantry';
      const left = pantryDaysLeft(i);
      if (!catDays[c] || left < catDays[c]) catDays[c] = left;
    });
    Object.keys(CATEGORY_SHELF_DAYS).forEach((cat) => {
      if (recs.length >= 8) return;
      const left = catDays[cat];
      const baseline = CATEGORY_SHELF_DAYS[cat];
      if (left != null && left >= 0 && left < baseline * 0.35) {
        recs.push({
          priority: 3,
          text: `${cat} is moving faster than its ~${baseline}d baseline — finish open packs before restocking.`,
        });
      }
    });
    if (recs.length <= 1) {
      recs.push({
        priority: 1,
        text: 'Add categorized pantry items to unlock expiry predictions vs category baselines.',
      });
    }
    return recs;
  }

  function formatExpiryInsight(item) {
    const r = getCategoryExpiryRisk(item);
    return r.text;
  }

  function estimateMonthlySavingsRupees(items, sustainability, usage) {
    return predictFootprintImpact(sustainability, items, usage).monthlySavingsINR;
  }

  global.SmartKitchenAI = {
    USAGE_KEY,
    CATEGORY_SHELF_DAYS,
    getUsage,
    recordVisit,
    recordPageView,
    recordKitchenAction,
    snapshotCategoryMix,
    migrateUsage,
    pantryExpiryDaysLocal,
    pantryDaysLeft,
    getShelfBaselineDays,
    analyzeBehavior,
    predictFootprintImpact,
    getCategoryExpiryRisk,
    getShoppingSuggestions,
    optimizeShoppingListOrder,
    getSmartRecommendations,
    formatExpiryInsight,
    estimateMonthlySavingsRupees,
  };
})(typeof window !== 'undefined' ? window : globalThis);
