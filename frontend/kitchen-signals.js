/* ============================================================
   Curated kitchen signals (LCA-style CO₂e, shelf hints, synonyms,
   complementary shopping pairs). Client-only; no network fetch.
   Values are approximate for category comparison — not product labels.
   ============================================================ */

(function (global) {
  /** kg CO₂e per kg food (retail-weight proxy) — order-of-magnitude from LCA literature */
  const co2eKgPerKgByCategory = {
    Produce: 0.9,
    Grains: 1.2,
    Bakery: 1.1,
    Pantry: 2.8,
    Dairy: 7.5,
  };

  const categoryShelfDays = {
    Bakery: 5,
    Produce: 7,
    Dairy: 14,
    Grains: 120,
    Pantry: 90,
  };

  /** Overrides when item name matches — refines generic category baselines */
  const keywordShelfDays = [
    { k: ['milk', 'cream'], days: 5 },
    { k: ['bread', 'bun', 'buns', 'roll', 'rolls', 'pav'], days: 5 },
    { k: ['spinach', 'lettuce', 'arugula', 'rocket'], days: 4 },
    { k: ['yogurt', 'yoghurt', 'curd'], days: 10 },
    { k: ['egg', 'eggs'], days: 21 },
    { k: ['paneer', 'tofu'], days: 5 },
    { k: ['rice', 'atta', 'flour', 'dal', 'lentil', 'lentils'], days: 180 },
    { k: ['banana', 'bananas'], days: 5 },
    { k: ['tomato', 'tomatoes'], days: 6 },
  ];

  /** Synonym groups — improves recipe ↔ pantry token overlap */
  const ingredientSynonymGroups = [
    ['tomato', 'tomatoes', 'cherry'],
    ['onion', 'onions', 'shallot', 'shallots'],
    ['garlic', 'clove', 'cloves'],
    ['potato', 'potatoes'],
    ['spinach', 'palak'],
    ['rice', 'chawal'],
    ['yogurt', 'yoghurt', 'curd'],
    ['oil', 'ghee'],
    ['salt', 'namak'],
    ['pepper', 'chilli', 'chili', 'mirch'],
    ['cumin', 'jeera'],
    ['turmeric', 'haldi'],
    ['coriander', 'cilantro', 'dhania'],
    ['paneer', 'cottage'],
    ['oat', 'oats'],
    ['flour', 'atta', 'maida'],
  ];

  /** If pantry or list already contains something matching `has`, suggest `suggest` */
  const shoppingPairs = [
    { has: ['bread', 'toast', 'bun'], suggest: 'Butter or eggs', reason: 'Common breakfast pair' },
    { has: ['pasta', 'spaghetti', 'noodles', 'rice'], suggest: 'Tomatoes or tomato paste', reason: 'Completes one-pot meals' },
    { has: ['milk', 'cream'], suggest: 'Oats or cereal', reason: 'Often bought together' },
    { has: ['egg', 'eggs'], suggest: 'Bread or cheese', reason: 'Quick meals & baking' },
    { has: ['onion', 'tomato'], suggest: 'Potatoes or beans', reason: 'Base for many curries' },
    { has: ['yogurt', 'curd'], suggest: 'Cucumber or mint', reason: 'Salads & raita' },
  ];

  global.KitchenSignals = {
    co2eKgPerKgByCategory,
    categoryShelfDays,
    keywordShelfDays,
    ingredientSynonymGroups,
    shoppingPairs,
  };
})(typeof window !== 'undefined' ? window : globalThis);
