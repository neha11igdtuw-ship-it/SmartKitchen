/**
 * Proxy to Python ML service (FastAPI). Falls back gracefully when unavailable.
 */

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://127.0.0.1:5050';
const TIMEOUT_MS = Number(process.env.ML_SERVICE_TIMEOUT_MS || 12000);

export async function mlHealth(req, res) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const r = await fetch(`${ML_SERVICE_URL}/health`, { signal: ctrl.signal });
    clearTimeout(t);
    const data = await r.json().catch(() => ({}));
    return res.status(r.ok ? 200 : 502).json({
      ok: r.ok && data.ok,
      mlServiceUrl: ML_SERVICE_URL,
      ...data,
    });
  } catch (e) {
    return res.status(503).json({
      ok: false,
      available: false,
      mlServiceUrl: ML_SERVICE_URL,
      error: 'ML service unreachable',
    });
  }
}

export async function mlPredict(req, res) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const r = await fetch(`${ML_SERVICE_URL}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(req.body || {}),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    const text = await r.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text.slice(0, 200) };
    }
    if (!r.ok) {
      return res.status(r.status).json({ ok: false, fallback: true, ...data });
    }
    return res.json(data);
  } catch (e) {
    const isAbort = e && e.name === 'AbortError';
    return res.status(503).json({
      ok: false,
      fallback: true,
      error: isAbort ? 'ML service timeout' : 'ML service unreachable',
      detail: process.env.NODE_ENV !== 'production' ? String(e.message || e) : undefined,
    });
  }
}
