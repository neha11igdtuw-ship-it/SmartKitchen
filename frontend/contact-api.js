/**
 * Contact form: POST /api/messages, list via GET /api/messages
 * Requires the Express server (serves this site and the API).
 */

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return '';
  }
}

async function loadContactMessages() {
  const list = document.getElementById('contact-messages-list');
  if (!list) return;
  try {
    const r = await fetch('/api/messages?limit=20');
    if (!r.ok) throw new Error('Request failed');
    const data = await r.json();
    if (!Array.isArray(data) || data.length === 0) {
      list.innerHTML =
        '<p class="contact-empty">No messages yet. Be the first to reach out.</p>';
      return;
    }
    list.innerHTML = data
      .map(
        (m) => `
      <article class="contact-msg-card">
        <div class="contact-msg-meta">${escapeHtml(m.name)} · ${escapeHtml(m.email)}</div>
        <p class="contact-msg-text">${escapeHtml(m.message)}</p>
        <time class="contact-msg-time">${escapeHtml(formatDate(m.createdAt))}</time>
      </article>
    `
      )
      .join('');
  } catch {
    list.innerHTML =
      '<p class="contact-error">Could not load messages. Start the backend and ensure MongoDB is running.</p>';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadContactMessages();

  const form = document.getElementById('contact-form');
  const statusEl = document.getElementById('contact-form-status');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const body = {
      name: String(fd.get('name') || '').trim(),
      email: String(fd.get('email') || '').trim(),
      message: String(fd.get('message') || '').trim(),
    };
    if (statusEl) {
      statusEl.textContent = '';
      statusEl.className = 'contact-form-hint';
    }
    const btn = form.querySelector('button[type="submit"]');
    if (btn) btn.disabled = true;
    try {
      const r = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || 'Could not send message');
      form.reset();
      if (statusEl) {
        statusEl.textContent = 'Message sent. Thanks!';
        statusEl.className = 'contact-form-hint success';
      }
      loadContactMessages();
    } catch (err) {
      if (statusEl) {
        statusEl.textContent = err.message || 'Something went wrong.';
        statusEl.className = 'contact-form-hint error';
      }
    } finally {
      if (btn) btn.disabled = false;
    }
  });
});
