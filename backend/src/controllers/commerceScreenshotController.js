/**
 * Gemini vision: extract grocery line items from order-app screenshots (Zepto, Blinkit, etc.).
 * Requires GEMINI_API_KEY — same key as AI Insights.
 */

import { commerceFoodCategories } from '../models/CommercePurchase.js';

const GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS || 35000);
const MAX_BASE64_LEN = 14_000_000;

function modelCandidates() {
  const envModel = process.env.GEMINI_MODEL && String(process.env.GEMINI_MODEL).trim();
  const defaults = [
    envModel,
    'gemini-2.0-flash',
    'gemini-2.0-flash-001',
    'gemini-1.5-flash',
    'gemini-1.5-flash-8b',
    'gemini-1.5-flash-latest',
    'gemini-1.5-pro',
  ];
  const out = [];
  const seen = new Set();
  for (const m of defaults) {
    if (!m || seen.has(m)) continue;
    seen.add(m);
    out.push(m);
  }
  return out;
}

function extractGeminiText(data) {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts
    .map((p) => (p && typeof p.text === 'string' ? p.text : ''))
    .join('')
    .trim();
}

function parseJsonFromModelText(text) {
  let t = String(text || '').trim();
  const fenced = t.match(/^```(?:json)?\s*([\s\S]*?)```$/m);
  if (fenced) t = fenced[1].trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start === -1 || end < start) throw new Error('No JSON object in model output');
  return JSON.parse(t.slice(start, end + 1));
}

function clip(s, n) {
  const x = String(s ?? '').trim();
  return x.length > n ? `${x.slice(0, n)}…` : x;
}

function sanitizeLines(raw) {
  if (!Array.isArray(raw)) return [];
  const cats = new Set(commerceFoodCategories);
  return raw
    .slice(0, 60)
    .map((row) => {
      const itemName = clip(row.itemName || row.name || '', 200);
      if (!itemName) return null;
      let cat = clip(row.category || 'Other', 40);
      if (!cats.has(cat)) cat = 'Other';
      const quantity =
        row.quantity != null && !Number.isNaN(Number(row.quantity))
          ? Math.max(0, Number(row.quantity))
          : 1;
      const unit = clip(row.unit || 'units', 24) || 'units';
      let amountInr = null;
      if (row.amountInr != null && row.amountInr !== '' && !Number.isNaN(Number(row.amountInr))) {
        const n = Number(row.amountInr);
        if (n >= 0 && n < 1e7) amountInr = Math.round(n * 100) / 100;
      }
      return { itemName, category: cat, quantity, unit, amountInr };
    })
    .filter(Boolean);
}

const CAT_LIST = commerceFoodCategories.join(', ');

const VISION_PROMPT = `You are reading a mobile app screenshot of a grocery order: "My orders", order details, or a list of products with names and prices (Zepto, Blinkit, BigBasket, Flipkart Grocery, Amazon, etc.).

Extract every distinct product line the user ordered. Ignore headers, navigation, delivery fee-only rows, and app chrome.

Return ONLY valid JSON (no markdown fences), exactly this shape:
{
  "platformGuess": string or null,
  "lines": [
    {
      "itemName": string,
      "quantity": number,
      "unit": string,
      "amountInr": number or null,
      "category": string
    }
  ]
}

platformGuess: short store name if visible (e.g. "Zepto"), else null.

category must be one of: ${CAT_LIST}. Use Other if unsure.

quantity defaults to 1 if not visible. unit examples: pcs, units, L, kg, g, ml, pack.
amountInr is the price in rupees for that line if shown; else null.
`;

export async function parseOrderScreenshot(req, res) {
  const key = process.env.GEMINI_API_KEY;
  if (!key || !String(key).trim()) {
    return res.status(503).json({
      error: 'Gemini API key missing. Add GEMINI_API_KEY to backend .env (Google AI Studio).',
      configured: false,
    });
  }

  const body = req.body || {};
  let rawB64 = body.imageBase64;
  let mimeType = body.mimeType && String(body.mimeType).trim().toLowerCase();

  if (typeof rawB64 !== 'string' || rawB64.length < 50) {
    return res.status(400).json({ error: 'imageBase64 is required (JPEG or PNG screenshot)' });
  }

  rawB64 = rawB64.replace(/^data:image\/\w+;base64,/i, '').trim();

  if (rawB64.length > MAX_BASE64_LEN) {
    return res.status(400).json({ error: 'Image too large; try under about 10MB.' });
  }

  if (!mimeType || mimeType === 'application/octet-stream') {
    mimeType = 'image/jpeg';
  }
  if (mimeType === 'image/jpg') mimeType = 'image/jpeg';
  if (!/^image\/(jpeg|png|webp)$/.test(mimeType)) {
    return res.status(400).json({ error: 'mimeType must be image/jpeg, image/png, or image/webp' });
  }

  const apiKey = String(key).trim();
  const errors = [];

  for (const model of modelCandidates()) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model
    )}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), GEMINI_TIMEOUT_MS);

    let r;
    try {
      r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: ctrl.signal,
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: VISION_PROMPT },
                { inline_data: { mime_type: mimeType, data: rawB64 } },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 4096,
          },
        }),
      });
    } catch (netErr) {
      clearTimeout(timer);
      errors.push(`${model}: ${netErr.name === 'AbortError' ? 'timeout' : netErr.message}`);
      continue;
    }
    clearTimeout(timer);

    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = data?.error?.message || `HTTP ${r.status}`;
      errors.push(`${model}: ${msg}`);
      continue;
    }

    const text = extractGeminiText(data);
    if (!text) {
      errors.push(`${model}: empty response`);
      continue;
    }

    try {
      const parsed = parseJsonFromModelText(text);
      const platformGuess =
        parsed.platformGuess != null ? clip(String(parsed.platformGuess), 80) : null;
      const lines = sanitizeLines(parsed.lines);
      return res.json({
        platformGuess,
        lines,
        model,
        configured: true,
        note:
          lines.length === 0
            ? 'No product lines found — try a clearer screenshot of the order list.'
            : undefined,
      });
    } catch (parseErr) {
      errors.push(`${model}: ${parseErr.message || 'parse error'}`);
    }
  }

  return res.status(502).json({
    error: 'Could not read order from image. Try another screenshot or add items manually.',
    configured: true,
    details: errors,
  });
}
