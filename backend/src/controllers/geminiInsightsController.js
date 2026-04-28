/**
 * Gemini-powered pantry / kitchen suggestions for AI Insights.
 * Requires GEMINI_API_KEY (Google AI Studio).
 */

const GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS || 25000);
const MAX_ITEMS = 60;
const MAX_NAME = 120;
const MAX_NOTE = 240;

/** Try env model first, then common IDs (404 / region differences). */
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

function clip(s, n) {
  if (s == null) return '';
  const t = String(s).trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
}

function sanitizePantry(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, MAX_ITEMS)
    .map((it) => ({
      name: clip(it.name, MAX_NAME) || 'Item',
      qty: it.qty != null ? Number(it.qty) : null,
      unit: clip(it.unit, 24),
      expires: clip(it.expires, 32),
      daysLeft: Number.isFinite(Number(it.daysLeft)) ? Number(it.daysLeft) : null,
      status: clip(it.status, 24),
      note: it.note ? clip(it.note, MAX_NOTE) : '',
    }));
}

function sanitizeShopping(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, 40)
    .map((x) => {
      if (typeof x === 'string') return clip(x, MAX_NAME);
      if (x && typeof x === 'object') return clip(x.name || x.item || x.text, MAX_NAME);
      return '';
    })
    .filter(Boolean);
}

function buildPrompt({ pantry, shoppingList, travelMode }) {
  const lines = pantry.map((p) => {
    const parts = [
      p.name,
      p.qty != null && !Number.isNaN(p.qty) ? `${p.qty} ${p.unit || 'units'}`.trim() : null,
      p.daysLeft != null ? `${p.daysLeft}d left` : null,
      p.expires ? `exp ${p.expires}` : null,
      p.status ? `[${p.status}]` : null,
      p.note ? `note: ${p.note}` : null,
    ].filter(Boolean);
    return `- ${parts.join(' · ')}`;
  });

  const shop =
    shoppingList.length > 0
      ? shoppingList.map((s) => `- ${s}`).join('\n')
      : '(none listed)';

  return `You are a concise kitchen assistant for the SmartKitchen app.

Pantry (use this to reduce waste and plan meals):
${lines.length ? lines.join('\n') : '(empty — suggest general pantry habits)'}

Shopping list ideas already on their list:
${shop}

Travel mode (slightly longer away / stretched timeline): ${travelMode ? 'yes' : 'no'}

Reply with 5–8 short, actionable suggestions. Prioritize items expiring soon, creative uses, restock, and food safety. Use a friendly tone. Format as plain bullet lines only, each starting with "• " (no markdown headings, no code fences). Keep total under 350 words.`;
}

function extractGeminiText(data) {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts
    .map((p) => (p && typeof p.text === 'string' ? p.text : ''))
    .join('')
    .trim();
}

export async function geminiInsightsStatus(req, res) {
  const key = process.env.GEMINI_API_KEY;
  res.json({
    configured: Boolean(key && String(key).trim().length > 0),
    models: modelCandidates(),
  });
}

export async function geminiPantryInsights(req, res) {
  const key = process.env.GEMINI_API_KEY;
  if (!key || !String(key).trim()) {
    return res.status(503).json({
      error: 'Gemini is not configured. Set GEMINI_API_KEY in the backend .env file.',
      configured: false,
    });
  }

  const body = req.body || {};
  const pantry = sanitizePantry(body.pantry);
  const shoppingList = sanitizeShopping(body.shoppingList);
  const travelMode = Boolean(body.travelMode);

  const prompt = buildPrompt({ pantry, shoppingList, travelMode });
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
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.75,
            maxOutputTokens: 2048,
          },
        }),
      });
    } catch (netErr) {
      clearTimeout(timer);
      const msg = netErr.name === 'AbortError' ? 'request timed out' : netErr.message;
      errors.push(`${model}: ${msg}`);
      console.warn(`Gemini model ${model} network error:`, msg);
      continue;
    }
    clearTimeout(timer);

    const data = await r.json().catch(() => ({}));

    if (!r.ok) {
      const msg = data?.error?.message || data?.error?.status || `HTTP ${r.status}`;
      errors.push(`${model}: ${msg}`);
      console.warn(`Gemini model ${model} failed:`, msg);
      continue;
    }

    const text = extractGeminiText(data);
    if (text) {
      return res.json({
        text,
        model,
        configured: true,
      });
    }

    const finish = data?.candidates?.[0]?.finishReason || 'unknown';
    errors.push(`${model}: no text (finish: ${finish})`);
  }

  const summary = errors.length ? errors.join(' | ') : 'No working Gemini model returned text.';
  console.error('Gemini all models failed:', summary);
  return res.status(502).json({
    error: summary,
    configured: true,
    details: errors,
  });
}
