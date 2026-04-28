/* Commerce API helpers (JWT from /api/auth) */
(function (global) {
  const BASE = '/api/commerce';

  function headers() {
    const t = localStorage.getItem('authToken');
    const h = { 'Content-Type': 'application/json' };
    if (t) h.Authorization = 'Bearer ' + t;
    return h;
  }

  async function req(path, opts = {}) {
    const r = await fetch(BASE + path, {
      ...opts,
      headers: { ...headers(), ...opts.headers },
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || r.statusText || 'Request failed');
    return data;
  }

  global.CommerceAPI = {
    isAuthenticated() {
      return !!localStorage.getItem('authToken');
    },
    profiles: {
      list: () => req('/profiles'),
      create: (body) => req('/profiles', { method: 'POST', body: JSON.stringify(body) }),
      remove: (id) => req('/profiles/' + encodeURIComponent(id), { method: 'DELETE' }),
    },
    purchases: {
      list: (q) => req('/purchases?' + new URLSearchParams(q || {})),
      create: (body) => req('/purchases', { method: 'POST', body: JSON.stringify(body) }),
      batch: (body) => req('/purchases/batch', { method: 'POST', body: JSON.stringify(body) }),
      remove: (id) => req('/purchases/' + encodeURIComponent(id), { method: 'DELETE' }),
    },
    /** Gemini vision: JPEG/PNG order screenshot → { lines, platformGuess } */
    parseOrderScreenshot: (body) =>
      req('/parse-order-screenshot', { method: 'POST', body: JSON.stringify(body) }),
    analytics: () => req('/analytics'),
  };
})(typeof window !== 'undefined' ? window : globalThis);
