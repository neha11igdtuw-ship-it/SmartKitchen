/**
 * Receipt OCR (Tesseract.js) + line parsing → pantry items (localStorage sk_pantry).
 */

let currentScanItems = [];
let currentScanMeta = { total: 0, store: 'Receipt', grandTotal: null };

function defaultExpiry(daysAhead = 7) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/**
 * Parse a single price token from OCR (handles ₹, Rs, decimal comma, thousand separators).
 * Wrong: stripping all commas turns "448,00" into 44800. Right: 448,00 → 448.00
 */
function parsePriceToken(raw) {
  let s = String(raw ?? '')
    .replace(/^[₹\s]+|[\s₹]+$/g, '')
    .replace(/^Rs\.?\s*/i, '')
    .trim();
  s = s.replace(/\s/g, '');
  if (!s || !/^\d/.test(s)) return NaN;
  // English/Indian thousands + dot decimals: 1,234.50 / 12,34,567.89
  const thousandsDot = /^(\d{1,3}(?:,\d{3})+)(\.\d+)?$/;
  if (thousandsDot.test(s)) {
    const m = s.match(thousandsDot);
    const n = parseFloat(m[1].replace(/,/g, '') + (m[2] || ''));
    return Number.isNaN(n) ? NaN : n;
  }
  // Decimal comma (common on printed receipts): 448,00  150,50  12,5
  if (/^\d+,\d{1,2}$/.test(s)) {
    const [a, b] = s.split(',');
    return parseFloat(`${a}.${b}`);
  }
  s = s.replace(/,/g, '');
  const n = parseFloat(s);
  return Number.isNaN(n) ? NaN : n;
}

/** kg / g / ml etc. — the number before these is weight/qty, not rupees. */
function isWeightUnitToken(tok) {
  return /^(kg|g|gm|ml|mL|L|liters?|litres?|pack|pcs?\.?)$/i.test(String(tok || '').trim());
}

/** OCR often glues "1kg" or "500g" into one token; split so we can ignore weight as price. */
function splitGluedWeightTokens(tokens) {
  const out = [];
  for (const tok of tokens) {
    const m = String(tok).match(/^(\d+(?:\.\d+)?)(kg|g|gm|ml|mL|L)$/i);
    if (m) {
      out.push(m[1], m[2]);
    } else {
      out.push(tok);
    }
  }
  return out;
}

/**
 * Receipt lines often list: name … qty … rate … amount. The amount is usually the last number.
 * E‑commerce tables (Flipkart) may end with qty "1" or "6" — pick the rightmost plausible rupee amount.
 * Do not treat the "1" in "1 kg" as ₹1 — skip numbers immediately before a weight unit.
 */
function splitLineNameAndPrice(line) {
  const cleaned = line.replace(/^\d+\s+/, '').trim();
  if (cleaned.length < 4) return null;
  let tokens = cleaned.split(/\s+/).filter(Boolean);
  tokens = splitGluedWeightTokens(tokens);
  if (tokens.length < 2) return null;

  const candidates = [];
  for (let i = tokens.length - 1; i >= 1; i--) {
    const t = tokens[i].replace(/^[₹]+|[₹]+$/g, '');
    if (!/[\d]/.test(t)) continue;
    if (/%$/.test(t)) continue;
    if (/^\(\d+\.?\d*\)$/.test(t)) continue;
    if (tokens[i + 1] && isWeightUnitToken(tokens[i + 1])) continue;
    if (tokens[i - 1] && isWeightUnitToken(tokens[i - 1])) {
      const pTry = parsePriceToken(t);
      if (Number.isFinite(pTry) && pTry > 0 && pTry <= 1) continue;
    }
    const priceNum = parsePriceToken(t);
    if (Number.isNaN(priceNum) || priceNum <= 0 || priceNum > 500000) continue;
    // HSN/SAC (4-digit) often sits before qty/rate/total — skip if a larger rupee amount appears later on the line.
    if (priceNum >= 1000 && priceNum <= 9999 && /^\d{4}$/.test(String(t).replace(/\s/g, ''))) {
      let maxAfter = 0;
      for (let j = i + 1; j < tokens.length; j++) {
        const tt = tokens[j].replace(/^[₹]+|[₹]+$/g, '');
        if (/%$/.test(tt)) continue;
        const p2 = parsePriceToken(tt);
        if (Number.isFinite(p2) && p2 > maxAfter) maxAfter = p2;
      }
      if (maxAfter > priceNum && maxAfter <= 500000) continue;
    }
    const digitsOnly = t.replace(/\D/g, '');
    if (digitsOnly.length >= 6 && !/\./.test(t) && priceNum >= 100000) continue;
    const namePart = tokens.slice(0, i).join(' ').trim();
    if (namePart.length < 2) continue;
    if (isNonProductLine(namePart, cleaned, priceNum)) continue;
    if (priceNum >= 100000 && priceNum <= 999999 && /^\d{6}$/.test(t.replace(/\s/g, ''))) {
      if (/,/.test(cleaned) || /\b(pradesh|meerut|road|nagar|colony|pin|supply|delhi)\b/i.test(cleaned)) continue;
    }
    candidates.push({ i, priceNum, namePart, t });
  }
  if (candidates.length === 0) return null;

  let chosen = candidates[0];
  const maxP = Math.max(...candidates.map((c) => c.priceNum));
  if (chosen.priceNum <= 15 && maxP > 50) {
    for (const c of candidates) {
      if (c.priceNum >= 20 && c.priceNum <= 50000) {
        chosen = c;
        break;
      }
    }
  }

  if (isNonProductLine(chosen.namePart, cleaned, chosen.priceNum)) return null;
  if (
    chosen.priceNum <= 1 &&
    maxP <= 1 &&
    candidates.length === 1 &&
    chosen.namePart.length > 35 &&
    /\b(masoor|dal|sooji|rava|atta|rice|classic|bombay)\b/i.test(chosen.namePart)
  )
    return null;

  return { namePart: chosen.namePart, priceNum: chosen.priceNum };
}

function formatInrDisplay(priceNum) {
  const n = Number(priceNum);
  if (Number.isNaN(n)) return '—';
  const rounded = Math.round(n * 100) / 100;
  if (Math.abs(rounded - Math.round(rounded)) < 1e-6) return `₹${Math.round(rounded)}`;
  return `₹${rounded.toFixed(2)}`;
}

/**
 * OCR often drops the decimal for rupees: ₹448.00 → "44800". Scale down when the number
 * looks like 100× too large for a typical grocery line (common range ~₹1–₹25,000).
 */
function normalizeInrPrice(priceNum) {
  let x = Math.abs(Number(priceNum));
  if (Number.isNaN(x) || x <= 0) return priceNum;
  while (x >= 10000 && x % 100 === 0) {
    const next = x / 100;
    if (next < 1) break;
    x = next;
  }
  if (x >= 5000 && x <= 99999 && x % 100 === 0) {
    const half = x / 100;
    if (half >= 25 && half <= 25000) x = half;
  }
  return Math.min(Math.round(x * 100) / 100, 500000);
}

/** Find bill grand total from raw OCR (footer lines), not as a line item. */
function extractGrandTotalFromText(text) {
  const lines = String(text)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 1);
  for (let i = lines.length - 1; i >= 0; i--) {
    const L = lines[i];
    const low = L.toLowerCase();
    const isGrandTotalLabel = /grand\s+total/i.test(low);
    const isFooterGrandOnly = /^[\s'"`"]*grand\s*[\d₹.,\s]+$/i.test(L);
    if (!isGrandTotalLabel && !isFooterGrandOnly) continue;
    const m = L.match(/([\d,]+\.\d{2}|[\d,]+)\s*$/);
    if (m) {
      const n = normalizeInrPrice(parsePriceToken(m[1]));
      if (!Number.isNaN(n) && n > 10 && n < 500000) return n;
    }
  }
  return null;
}

function isGrandFooterName(nameRaw) {
  const n = String(nameRaw || '').trim();
  if (n.length < 2) return false;
  return /^[\s'"`"]*grand(?:\s+total)?\s*$/i.test(n);
}

function isTaxOrHeaderLine(nameRaw, priceNum) {
  const n = String(nameRaw).toLowerCase().trim();
  if (isGrandFooterName(nameRaw)) return true;
  if (/^(igst|sgst|cgst|gst|vat|sub\s*total|grand\s*total|total\s*amount|bill\s*no|invoice|date:)/i.test(n))
    return true;
  if (/^(igst|sgst|cgst|gst|st|vat)\s+at$/i.test(n)) return true;
  if (priceNum === 0 && /\b(igst|sgst|cgst|gst)\b/i.test(n)) return true;
  return false;
}

/** Skip entire OCR line before parsing (e‑commerce invoices, footers, tax blocks). */
function shouldSkipInvoiceLine(line) {
  const L = String(line || '').trim();
  if (L.length < 3) return true;
  const low = L.toLowerCase();

  if (
    /^(sub\s*total|total\s*amount|grand\s*total|amount\s*incl|\.?\s*totalamount|handling\s*fee|payment\s*method|total\s*items|sold\s*by|ship\s*to|bill\s*to|qr\s*code)/i.test(
      low
    )
  )
    return true;
  if (/^you\s+have\s+saved|saved\s*rs\.?|grand\s*$/i.test(low)) return true;
  if (/^[\s'"`"]*grand(?:\s+total)?\s*[\d₹.,\s]*$/i.test(low)) return true;
  if (/total\s*amount\s*\(?food|non-?food|mrt?p|savings\s*\(?rs/i.test(low)) return true;
  if (/invoice\s*(number|no\.?|date)|order\s*(id|date)|order\s*id/i.test(low) && /\d{5,}/.test(L)) return true;
  if (/^(order|invoice|bill)\s*[:#]?\s*$/i.test(low)) return true;
  if (/table\s*no\.?|tablel\s*no/i.test(low)) return true;
  if (/have\s+a\s*nice|nice\s*day|thank\s*you|e\s*&\s*o\s*e|cashier\s*:/i.test(low)) return true;
  if (/authorised\s*signatory|authorized\s*signatory|tax\s*break|flipkart\.com/i.test(low)) return true;
  if (/add\s+[sc]\s*gst|add\s+.*gst\s*\(/i.test(low)) return true;
  if (/^s\.?\s*no\.?\s*item|item\s*hsn|hsn\s*\(tax/i.test(low)) return true;
  if (/forshopping|for\s+shopping|shopping\s*win|win\s*prize|scan\s*to\s*pay/i.test(low)) return true;

  const digitRun = L.replace(/[^\d]/g, '');
  if (digitRun.length >= 14 && /^[\d\s,.:-]+$/i.test(L.replace(/[a-z]/gi, '').trim())) return true;
  if (/\d{10,}/.test(L) && /order|onder|invoice|invoic|nvoice|bill\s*to|ship\s*to/i.test(low)) return true;
  if (/[A-Z]{2,}\d{6,}|[A-Z0-9]{8,}/i.test(L) && /invoice|invoic|number|no\.?\s/i.test(low)) return true;
  if (/\d{12,}/.test(L) && /order|invoice|od\d/i.test(low)) return true;

  return false;
}

/** Drop parsed rows that are clearly not groceries (OCR garbage / invoice fragments). */
function isJunkParsedItemName(nameRaw) {
  const n = String(nameRaw || '').trim();
  if (n.length < 2) return true;
  if (isGrandFooterName(nameRaw)) return true;
  const low = n.toLowerCase();
  if (/^\.?\s*total\s*amount|totalamount|^grand$|you\s+have\s+saved|saved\s*rs/i.test(low)) return true;
  if (/\border\s*(id|date)|invoice\s*(no|number|date)/i.test(low)) return true;
  if (/^(ol|o|e|ol\s*e)$/i.test(low)) return true;
  if (/^gr$/i.test(low)) return true;
  if (/forshopping|for\s+shopping|shopping\s*win|flipkart\s*advantage/i.test(low)) return true;
  if (/\[.*`|^\.\s*\[|omarom|\bwoo\s*\[/i.test(low)) return true;
  const letters = (n.match(/[a-z]/gi) || []).length;
  const digits = (n.match(/\d/g) || []).length;
  if (letters < 4 && digits > 8) return true;
  if (/^[\d\s,.-]{8,}$/.test(n)) return true;
  if (letters >= 6) {
    const vowels = (n.match(/[aeiou]/gi) || []).length;
    if (vowels / letters < 0.12) return true;
  }
  return false;
}

const GROCERY_NAME_HINT =
  /\b(dal|masoor|lentil|bean|pulse|urad|moong|toor|chana|rice|atta|flour|wheat|sooji|rava|bombay|soof|oil|ghee|sugar|salt|tea|coffee|milk|paneer|cheese|spice|masala|grain|cereal|classic|black|grocery|tomato|onion|potato|spinach|carrot|apple|banana|orange|lemon|fruit|vegetable|herb|ginger|garlic|bread|bagel|croissant|bakery|cake|muffin|noodle|pasta|oat|snack|egg|curd|yoghurt|yogurt|cream|butter|honey|berries|greens?|walnut|almond|cashew|nuts?|juice|water|soda|cola|maggi|vermicelli|poha|besan|maida|suji|baking\s*powder|chilli\s*powder|turmeric\s*powder)\b/i;

/** Non-food retail / household — still valid receipt lines (do not drop in isUnlikelyProductLine). */
const RETAIL_PRODUCT_HINT =
  /\b(backpack|school\s*bag|skybag|laptop\s*bag|duffel|trolley|luggage|shoes?|sandal|slipper|apparel|clothing|shirt|trouser|watch|phone|charger|cable|battery|toy|notebook|pen|pencil|detergent|soap|surf|cleaner|bleach|washing|dishwash|toilet\s*cleaner|mop|bucket|steel|plastic|bottle|container|kitchenware|non-?stick|pan|pot|skillet)\b/i;

/** Reject heavily garbled lines that lack any grocery-like word (Flipkart footers, QR noise). */
function isUnlikelyProductLine(nameRaw) {
  const n = String(nameRaw || '').trim();
  if (n.length < 3) return true;
  if (GROCERY_NAME_HINT.test(n)) return false;
  if (RETAIL_PRODUCT_HINT.test(n)) return false;
  const low = n.toLowerCase();
  if (/lckmascor|ppk\s*goce|mascor\s*d\s*\(wi|fpkart\s*groceny|groceny\s*geo/i.test(low)) return true;
  if (/^o\s+lck|^lck/i.test(low) && !/classic|dal|masoor|rava|sooji/i.test(low)) return true;
  const letters = (n.match(/[a-z]/gi) || []).length;
  if (letters < 4) return true;
  if (letters >= 10) {
    const vowels = (n.match(/[aeiou]/gi) || []).length;
    if (vowels / letters < 0.12) return true;
  }
  return false;
}

/** Invoice / address / GST meta (not a product line). */
function isNonProductLine(nameRaw, fullLine, priceNum) {
  const name = String(nameRaw || '');
  const line = String(fullLine || name);
  const blob = `${name} ${line}`.toLowerCase();

  if (
    /\b(place\s+of\s+supply|billing\s+details|invoice\s+(number|no|id)|e-?invoice|gstin|gst\s+in|tax\s+invoice|fssai|eway|e-?way|bill\s+to|ship\s+to|sold\s+by|customer\s+details|company\s+details|address|pin\s*code|pincode|phone|email|@\w|www\.|tel\.|ph\.)\b/i.test(
      blob
    )
  )
    return true;
  if (/\b(you\s+have\s+saved|grand\s*total|total\s*amount|amount\s*incl|handling\s*fee|\.?\s*totalamount)\b/i.test(blob)) return true;
  if (/\border\s*id|invoice\s*number|invoice\s*no\.?\b/i.test(blob) && /\d{6,}/.test(line)) return true;
  if (
    /\b(uttar\s+pradesh|madhya\s+pradesh|andhra\s+pradesh|haryana|punjab|gujarat|maharashtra|karnataka|rajasthan|delhi|noida|gurgaon|meerut|tamil\s+nadu|west\s+bengal)\b/i.test(
      blob
    )
  )
    return true;
  if (
    /\b(nagar|colony|road|street|lane|district|block|sector|laxmi)\b/i.test(blob) &&
    (/,/.test(line) || /\//.test(line))
  )
    return true;
  if (/,\s*meerut|,\s*\w+\s+\w+pradesh|\/\d+\s*,|\/\d+\s*,\s*\w+/i.test(blob)) return true;
  // GST table rows often have 2+ comma-formatted amounts (e.g. 1,500.00 1,680.00) — do not treat as address.
  if ((line.match(/,/g) || []).length >= 3) {
    const nameOnly = String(nameRaw || '').trim();
    const looksLikeProductLine =
      nameOnly.length >= 12 && /[a-z]{4,}/i.test(nameOnly) && !/^(billing|invoice|place|details|company|customer|address|gst|order|grand)\b/i.test(nameOnly.trim());
    if (!looksLikeProductLine) return true;
  }
  if (/^(billing|invoice|place|details|company|customer|address|gst|order|grand)\b/i.test(name.trim())) return true;
  if (isGrandFooterName(nameRaw)) return true;

  const v = Number(priceNum);
  if (Number.isFinite(v) && v >= 100000 && v <= 999999 && Math.abs(v - Math.round(v)) < 1e-6) {
    if (/\b\d{6}\s*$/.test(line.replace(/\s+/g, ' ').trim())) return true;
    if (/,/.test(line) && /\b(pradesh|meerut|road|nagar|colony|pin|delhi|sector|block|supply)\b/i.test(blob)) return true;
  }
  if (Number.isFinite(v) && v >= 100000 && v <= 999999 && /^\/\d+/.test(line.trim())) return true;

  return false;
}

function guessCategory(name) {
  const n = String(name).toLowerCase();
  if (/detergent|soap|surf|cleaner|bleach|washing|dishwash|toilet\s*cleaner|mop|fabric\s*care|laundry/.test(n)) return 'Pantry';
  if (/milk|cheese|yogurt|yoghurt|butter|cream|dairy|egg|paneer|curd/.test(n)) return 'Dairy';
  if (/bread|bagel|bun|toast|croissant|bakery|cake|muffin/.test(n)) return 'Bakery';
  if (/apple|banana|orange|tomato|onion|potato|spinach|lettuce|carrot|fruit|vegetable|produce|herb|ginger|garlic|lemon/.test(n))
    return 'Produce';
  if (/\b(chilli|chili|turmeric|baking|garlic|onion|ginger|coriander|cocoa)\s*powder\b|powder/.test(n)) return 'Produce';
  if (/rice|wheat|flour|oats|oat|pasta|noodle|grain|pulse|dal|lentil|bean|cereal/.test(n)) return 'Grains';
  return 'Pantry';
}

/**
 * Common OCR mistakes on receipts: "Pcs." (pieces) often reads as "Pes." when the "c" looks like "e".
 */
function fixOcrUnitWords(s) {
  return String(s)
    .replace(/\bPes\.?\b/gi, 'Pcs.')
    .replace(/\bpes\b(?=\s|$|[,.])/gi, 'pcs');
}

/**
 * Strip GST/tax line fragments that OCR glues into the product name, e.g.
 * "Cheese 12% Tax Item", "Cheese12%Tax 1", "Walnuts 5% Tax Item", "Con3%Taxllem" (Tax Item).
 */
function stripTaxGlueFromProductName(raw) {
  let s = fixOcrUnitWords(String(raw)).replace(/\s+/g, ' ').trim();
  if (s.length < 2) return s;

  s = s.replace(/\bTaxllem\b/gi, 'Tax Item').replace(/\bTaxlem\b/gi, 'Tax Item');
  s = s.replace(/\s+Tax\s+Item\s*$/i, '').trim();

  let cut = s.search(/\d{1,3}\s*%\s*Tax\b/i);
  if (cut === -1) cut = s.search(/\d{1,3}%Tax/i);
  if (cut > 0) s = s.slice(0, cut).trim();

  s = s.replace(/\s+\d+\s+[\d,.]+$/i, '').trim();
  s = s.replace(/\s+1\s+\d{4,6}\s*$/i, '').trim();
  s = s.replace(/\s+\d{5,6}\s*$/i, '').trim();
  s = s.replace(/\s+\b1\b\s*$/i, '').trim();

  s = s.replace(/^[\d]+\.?\s*/, '');
  s = s.replace(/\s+(Bags?|Pcs\.?|Pek\.?|Box(es)?|Nos\.?)\s*$/i, '').trim();

  const triplePrice = s.match(
    /^(.+?)\s+(\d{1,3}(?:\.\d{1,2})?)\s+(\d{1,3}(?:\.\d{1,2})?)\s+(\d{1,3}(?:\.\d{1,2})?)\s*$/i
  );
  if (triplePrice && triplePrice[1].trim().length >= 3) s = triplePrice[1].trim();

  const qtyBadPrice = s.match(/^(.+?)\s+(\d{1,3}(?:\.\d+)?)\s+(\d{4,6})\s*$/);
  if (qtyBadPrice && qtyBadPrice[1].trim().length >= 3) s = qtyBadPrice[1].trim();

  s = s.replace(/\s+by\s+(Flipkart|Fpkart)\s*Groc\w*(\s*,?\s*geo)?/gi, ' ').trim();
  s = s.replace(/\s+nosm\s+\d+$/i, '').trim();
  s = s.replace(/\s+geo\s*$/i, '').trim();
  s = s.replace(/,\s*$/g, '').trim();
  s = s.replace(/\bDl\b/gi, 'Dal').replace(/\(\s*Wrole\s*\)/gi, '(Whole)');

  if (/^con$/i.test(s)) s = 'Coin';

  return s.trim();
}

/**
 * E‑commerce invoice rows glue HSN, qty, MRP, savings into the "name" string.
 * Cut at HSN/junk punctuation and strip trailing column numbers (B5.00, 222.00).
 */
function stripInvoiceTableNoiseFromName(raw) {
  let t = String(raw).replace(/\s+/g, ' ').trim();
  if (t.length < 2) return t;

  const cutAt = (idx) => {
    if (idx > 0 && idx >= 8) t = t.slice(0, idx).trim();
  };

  cutAt(t.search(/\s+\d{7,9}\s+(\(\d+\.?\d*\))?/));
  cutAt(t.search(/\s+\d{4,8}\s+\(\d+\.?\d*\)\s+\d/));

  const commaJunk = t.search(/,\s*[\?;{]/);
  if (commaJunk > 0 && commaJunk >= 10) t = t.slice(0, commaJunk).trim();

  const packThenJunk = t.search(/,\s*\d{2,4}\s+\?/);
  if (packThenJunk > 0 && packThenJunk >= 12) t = t.slice(0, packThenJunk).trim();

  cutAt(t.search(/\s+\?\s*\d{3,}/));
  cutAt(t.search(/\?\d{3,}\?/));

  const sym = t.search(/[?;{]\s*[?!;:{|'"`l0-9]/i);
  if (sym > 0 && sym >= 12) t = t.slice(0, sym).trim();

  t = t.replace(/,\s+E\s*[''`"].*$/i, '').trim();
  t = t.replace(/,\s+[A-Za-z]\s*[''`":;!?.].*$/i, '').trim();
  t = t.replace(/\s+E\s*[''`"][^a-zA-Z]{2,}.*$/i, '').trim();
  t = t.replace(/\s+\d{1,2}\s+B?\d+\.\d{2}(\s+\d{2,3}\.\d{2})+.*$/i, '').trim();
  t = t.replace(/\s+\d{1,3}\s+\d{2,3}\.\d{2}(\s+\d{2,3}\.\d{2})?.*$/i, '').trim();
  t = t.replace(/\s+\d+\s+\d+\s+B\d+\.\d{2}.*$/i, '').trim();
  t = t.replace(/\s+B\d+\.\d{2}.*$/i, '').trim();

  t = t.replace(/,\s*$/g, '').trim();
  return t;
}

/**
 * Invoice tables often OCR as one long line. Take the product description:
 * text before HSN/SAC (4-digit code), strip pipes and trailing unit columns.
 */
function cleanItemDescription(raw) {
  let s = fixOcrUnitWords(raw);
  s = s.replace(/\|/g, ' ').replace(/\s+/g, ' ').trim();
  s = s.replace(/^[\d]+\.?\s*/, '');
  s = s.replace(/\bDl\b/gi, 'Dal').replace(/\(\s*Wrole\s*\)/gi, '(Whole)');

  s = s.replace(/\s+\d{8}\s*(\(\d+\.?\d*\))?/g, ' ').replace(/\s+/g, ' ').trim();

  const beforeHsn = s.match(/^(.+?)\s+(\d{4,8})\s+/);
  if (beforeHsn && beforeHsn[1].trim().length >= 2) {
    s = beforeHsn[1].trim();
  }

  s = s.replace(/\s+(Bags?|Pcs\.?|Pek\.?|Box(es)?|Nos\.?)\s*$/i, '').trim();
  s = fixOcrUnitWords(s);
  // OCR noise: "OrangePowder 1 40000" (quantity + misread price glued into name)
  s = s.replace(/\s+1\s+\d{4,6}\s*$/i, '').trim();
  s = s.replace(/\s+\d{5,6}\s*$/i, '').trim();

  const junkTail = /\s+(\d+\.?\d*)\s*%\s*$/;
  while (junkTail.test(s)) s = s.replace(junkTail, '').trim();

  if (s.length > 90) {
    const short = s.match(
      /^([A-Za-z0-9][A-Za-z0-9\s.\-]+?(?:\s(?:kg|g|gm|ml|mL|L|l|pack|pcs?\.?))\b)/i
    );
    if (short) s = short[1].trim();
  }

  s = stripTaxGlueFromProductName(s);
  s = stripInvoiceTableNoiseFromName(s);

  return s.slice(0, 120).trim();
}

function parseQtyFromLine(nameRaw) {
  let name = fixOcrUnitWords(nameRaw).replace(/\s+/g, ' ').trim();
  let qtyNum = 1;
  let unit = 'pieces';
  let qtyStr = '1';

  const xMatch = name.match(/^(\d+(?:\.\d+)?)\s*[xX×]\s*(.+)$/);
  if (xMatch) {
    qtyNum = parseFloat(xMatch[1]);
    name = xMatch[2].trim();
    qtyStr = `${qtyNum} pieces`;
  }

  const kg = name.match(/([\d.]+)\s*kg\b/i);
  if (kg) {
    qtyNum = parseFloat(kg[1]);
    unit = 'kg';
    qtyStr = `${qtyNum} kg`;
    name = name.replace(kg[0], '').trim();
  }

  const g = name.match(/([\d.]+)\s*g\b/i);
  if (g && !kg) {
    qtyNum = parseFloat(g[1]);
    unit = 'g';
    qtyStr = `${qtyNum} g`;
    name = name.replace(g[0], '').trim();
  }

  const L = name.match(/([\d.]+)\s*(?:l|L|liters?|litres?)\b/);
  if (L) {
    qtyNum = parseFloat(L[1]);
    unit = 'liters';
    qtyStr = `${qtyNum} liters`;
    name = name.replace(L[0], '').trim();
  }

  const ml = name.match(/([\d.]+)\s*ml\b/i);
  if (ml && !L) {
    qtyNum = parseFloat(ml[1]);
    unit = 'ml';
    qtyStr = `${qtyNum} ml`;
    name = name.replace(ml[0], '').trim();
  }

  const cups = name.match(/([\d.]+)\s*cups?\b/i);
  if (cups) {
    qtyNum = parseFloat(cups[1]);
    unit = 'cups';
    qtyStr = `${qtyNum} cups`;
    name = name.replace(cups[0], '').trim();
  }

  if (name.length < 2) name = nameRaw.slice(0, 80);

  return { cleanName: name.slice(0, 120), qtyNum, unit, qtyStr };
}

function parseReceiptText(text) {
  const lines = String(text)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 1);

  const skip = new RegExp(
    '^(TOTAL|SUB\\s*TOTAL|SUBTOTAL|GST|TAX|VAT|CGST|SGST|CARD|CASH|UPI|NEFT|CHANGE|BALANCE|THANK|DATE|TIME|PHONE|FAX|WWW\\.|HTTP|HTTPS|RECEIPT|INVOICE|STORE|CASHIER|ITEM\\s*#|ITEM\\s+DESCRIPTION|HSN|LIST\\s+PRICE|BILLING|PLACE\\s+OF\\s+SUPPLY|GSTIN|E-?INVOICE|-----|=====|_{3,}|\\*{3,})',
    'i'
  );

  const items = [];
  const seen = new Set();

  for (let line of lines) {
    if (skip.test(line)) continue;
    if (shouldSkipInvoiceLine(line)) continue;
    line = fixOcrUnitWords(line);
    line = line.replace(/^\d+\s+/, '').trim();
    if (line.length < 3 || line.length > 280) continue;
    if (shouldSkipInvoiceLine(line)) continue;

    let namePart;
    let priceNum;

    const split = splitLineNameAndPrice(line);
    if (split) {
      namePart = split.namePart;
      priceNum = split.priceNum;
    } else {
      let m = line.match(/^(.+?)\s+(?:₹|Rs\.?|INR)\s*([\d,]+\.?\d*)\s*$/i);
      if (!m) m = line.match(/^(.+?)\s+([\d,]+\.\d{2})\s*$/);
      if (!m) m = line.match(/^(.+?)\s+([\d,]+\.?\d*)\s*$/);
      if (!m) continue;
      namePart = m[1].replace(/\s+/g, ' ').trim();
      priceNum = parsePriceToken(m[2]);
    }

    if (Number.isNaN(priceNum) || priceNum > 500000) continue;
    if (namePart.length < 2) continue;

    namePart = cleanItemDescription(namePart.replace(/\s+/g, ' ').trim());
    priceNum = normalizeInrPrice(priceNum);
    if (isJunkParsedItemName(namePart)) continue;
    if (isUnlikelyProductLine(namePart)) continue;
    if (isTaxOrHeaderLine(namePart, priceNum)) continue;
    if (isNonProductLine(namePart, line, priceNum)) continue;
    if (priceNum === 0) continue;

    const key = namePart.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const q = parseQtyFromLine(namePart);
    const cat = guessCategory(q.cleanName);
    items.push({
      name: q.cleanName,
      qty: q.qtyStr,
      price: formatInrDisplay(priceNum),
      cat,
      qtyNum: q.qtyNum,
      unit: q.unit,
    });
  }

  return items;
}

function getPantryList() {
  try {
    const raw = localStorage.getItem('sk_pantry');
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  if (typeof KitchenStore !== 'undefined') {
    try {
      return KitchenStore.getData().pantryItems || [];
    } catch (_) {}
  }
  return [];
}

function savePantryList(list) {
  localStorage.setItem('sk_pantry', JSON.stringify(list));
  if (typeof KitchenStore !== 'undefined') {
    try {
      const data = KitchenStore.getData();
      data.pantryItems = list;
      KitchenStore.saveData(data);
    } catch (_) {}
  }
}

function pushScanHistory(entry) {
  try {
    const key = 'sk_scan_history';
    const prev = JSON.parse(localStorage.getItem(key) || '[]');
    prev.unshift(entry);
    localStorage.setItem(key, JSON.stringify(prev.slice(0, 30)));
  } catch (_) {}
}

function loadScanHistory() {
  try {
    return JSON.parse(localStorage.getItem('sk_scan_history') || '[]');
  } catch (_) {
    return [];
  }
}

function renderScanHistory() {
  const el = document.getElementById('scan-history');
  if (!el) return;
  const scanHistory = loadScanHistory();
  if (scanHistory.length === 0) {
    el.innerHTML =
      '<p style="color:var(--text-muted);font-size:0.88rem">No scans yet. Upload a receipt image to get started.</p>';
    return;
  }
  el.innerHTML = scanHistory
    .map(
      (h, i) => `
    <div class="history-item fade-in" style="animation-delay:${i * 0.04}s">
      <div>
        <div class="list-item-name"><span class="nav-icon" data-ui-icon="store" aria-hidden="true"></span> ${escapeHtml(h.store)}</div>
        <div class="list-item-sub">${escapeHtml(h.date)} • ${h.items} items</div>
      </div>
      <span style="font-weight:700;color:var(--text-dark)">${escapeHtml(h.total)}</span>
    </div>
  `
    )
    .join('');
  if (typeof injectUiIcons === 'function') injectUiIcons();
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

function showScanResultTable() {
  const el = document.getElementById('scan-result');
  const tbody = document.getElementById('scan-tbody');
  if (!el || !tbody) return;
  el.style.display = 'block';

  let sum = 0;
  tbody.innerHTML = currentScanItems
    .map((i) => {
      const n = parseFloat(String(i.price).replace(/^₹/, '').replace(/,/g, '')) || 0;
      if (!Number.isNaN(n)) sum += n;
      return `<tr><td><strong>${escapeHtml(i.name)}</strong></td><td>${escapeHtml(i.qty)}</td><td>${escapeHtml(i.price)}</td><td><span class="badge badge-green">${escapeHtml(i.cat)}</span></td></tr>`;
    })
    .join('');

  tbody.innerHTML += `<tr class="total-row"><td colspan="2"><strong>Total (line items)</strong></td><td colspan="2"><strong>₹${sum.toLocaleString('en-IN')}</strong></td></tr>`;
  if (currentScanMeta.grandTotal != null && Number.isFinite(Number(currentScanMeta.grandTotal))) {
    const g = Number(currentScanMeta.grandTotal);
    tbody.innerHTML += `<tr class="total-row"><td colspan="2"><strong>Grand total (receipt)</strong></td><td colspan="2"><strong>₹${g.toLocaleString('en-IN')}</strong></td></tr>`;
  }
}

function addAllToPantry() {
  if (!currentScanItems.length) {
    if (typeof showToast === 'function') showToast('No items to add. Scan a receipt first.', 'warning');
    return;
  }

  let list = getPantryList();
  let maxId = list.reduce((m, i) => Math.max(m, Number(i.id) || 0), 0);
  const exp = defaultExpiry(7);
  const days = 7;

  for (const row of currentScanItems) {
    maxId += 1;
    list.unshift({
      id: maxId,
      name: row.name,
      cat: row.cat,
      qty: row.qtyNum,
      unit: row.unit,
      expires: exp,
      runout: `${days}d`,
      status: days <= 2 ? 'urgent' : days <= 7 ? 'warning' : 'good',
    });
  }

  savePantryList(list);

  let histSum = 0;
  for (const row of currentScanItems) {
    const n = parseFloat(String(row.price).replace(/^₹/, '').replace(/,/g, '')) || 0;
    if (!Number.isNaN(n)) histSum += n;
  }
  const totalStr = `₹${histSum.toLocaleString('en-IN')}`;
  pushScanHistory({
    date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
    store: currentScanMeta.store,
    items: currentScanItems.length,
    total: totalStr,
  });
  renderScanHistory();

  if (typeof showToast === 'function') {
    showToast(`${currentScanItems.length} item(s) added to your pantry`, 'success');
  }
}

async function runReceiptOcr(file) {
  const proc = document.getElementById('processing');
  const procSub = proc && proc.querySelector('.processing-sub');
  if (proc) proc.classList.add('show');
  if (typeof Tesseract === 'undefined') {
    if (proc) proc.classList.remove('show');
    if (typeof showToast === 'function') showToast('OCR library not loaded. Check your connection.', 'error');
    return;
  }

  try {
    const {
      data: { text },
    } = await Tesseract.recognize(file, 'eng', {
      logger(m) {
        if (procSub && m.status === 'recognizing text' && m.progress != null) {
          procSub.textContent = `Reading text… ${Math.round(m.progress * 100)}%`;
        }
      },
    });

    const parsed = parseReceiptText(text);
    const grandTotal = extractGrandTotalFromText(text);
    if (parsed.length === 0) {
      if (typeof showToast === 'function') {
        showToast('Could not read line items. Try a clearer, well-lit photo of the receipt.', 'warning');
      }
      currentScanItems = [];
      currentScanMeta = { store: 'Receipt', total: 0, grandTotal };
    } else {
      currentScanItems = parsed;
      let sum = 0;
      parsed.forEach((p) => {
        const n = parseFloat(String(p.price).replace(/^₹/, '').replace(/,/g, '')) || 0;
        if (!Number.isNaN(n)) sum += n;
      });
      currentScanMeta = { store: 'Scanned receipt', total: sum, grandTotal };
    }

    showScanResultTable();
    if (parsed.length > 0 && typeof showToast === 'function') showToast('Receipt scanned successfully', 'success');
  } catch (e) {
    console.error(e);
    if (typeof showToast === 'function') showToast('Scan failed. Try another image.', 'error');
  } finally {
    if (proc) proc.classList.remove('show');
    if (procSub) procSub.textContent = 'AI is extracting items from your receipt';
  }
}

function processReceipt(ev) {
  const input = document.getElementById('file-input');
  const file = input && input.files && input.files[0];
  if (!file) return;

  if (file.type === 'application/pdf') {
    if (typeof showToast === 'function') {
      showToast('PDF is not supported here. Please upload a JPG or PNG photo of the receipt.', 'warning');
    }
    input.value = '';
    return;
  }

  if (!file.type.startsWith('image/')) {
    if (typeof showToast === 'function') showToast('Please upload an image (JPG or PNG).', 'warning');
    input.value = '';
    return;
  }

  runReceiptOcr(file);
  input.value = '';
}

window.processReceipt = processReceipt;
window.addAllToPantry = addAllToPantry;

document.addEventListener('DOMContentLoaded', () => {
  renderScanHistory();
  const dz = document.getElementById('drop-zone');
  if (dz) {
    dz.addEventListener('dragover', (e) => {
      e.preventDefault();
      dz.classList.add('dragover');
    });
    dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
    dz.addEventListener('drop', (e) => {
      e.preventDefault();
      dz.classList.remove('dragover');
      const file = e.dataTransfer.files && e.dataTransfer.files[0];
      if (!file) return;
      if (file.type.startsWith('image/')) runReceiptOcr(file);
      else if (typeof showToast === 'function') showToast('Drop a JPG or PNG image of your receipt.', 'warning');
    });
  }
});
