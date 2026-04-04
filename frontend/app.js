/* ============================================================
   SMART KITCHEN – Shared App JavaScript
   ============================================================ */

// ─── Global app state (Persisted via KitchenStore) ───────────
let savedName = localStorage.getItem('userName') || '';
let savedInitials = savedName
  ? savedName.split(' ').map((n) => n[0]).join('').toUpperCase().substring(0, 2)
  : '';

/** Refreshed after initKitchenSync() on DOMContentLoaded */
const AppState = (typeof KitchenStore !== 'undefined')
  ? KitchenStore.getData()
  : {
      pantryItems: [],
      shoppingList: [],
      notifications: 0,
      userName: savedName,
      userInitials: savedInitials,
      notifData: [],
    };

// Ensure AppState reflects current storage if KitchenStore was used
if (typeof KitchenStore !== 'undefined') {
  AppState.userName = savedName;
  AppState.userInitials = savedInitials;
}

// ─── Update UI with User Info ──────────────────────────────────
function updateUserInfoUI() {
  const nameEls = document.querySelectorAll('.user-name');
  const avatarEls = document.querySelectorAll('.user-avatar, .profile-avatar');
  const welcomeEl = document.querySelector('.page-title');
  const profileInput = document.getElementById('profile-name');
  const emailInput = document.getElementById('profile-email');
  const userInfoBox = document.querySelector('.user-info');

  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  const isAllowedPage = ['dashboard.html', 'settings.html'].includes(currentPage);
  const isShopkeeperPage = ['shopkeeper-dashboard.html', 'shopkeeper-deals.html'].includes(currentPage);

  if (userInfoBox) {
    userInfoBox.style.display = isAllowedPage || isShopkeeperPage ? 'flex' : 'none';
  }

  if (isAllowedPage) {
    nameEls.forEach((el) => {
      if (el.classList.contains('sk-user-name')) return;
      el.textContent = AppState.userName;
    });
    avatarEls.forEach((el) => {
      if (el.classList.contains('sk-user-avatar')) return;
      el.textContent = AppState.userInitials || 'U';
    });
    
    if (welcomeEl && welcomeEl.textContent.toLowerCase().includes('welcome back') && AppState.userName) {
      welcomeEl.textContent = `Welcome back, ${AppState.userName.split(' ')[0]}`;
    }

    if (profileInput) profileInput.value = AppState.userName;
    if (emailInput) {
      emailInput.value = localStorage.getItem('userEmail') || '';
    }
  }
}

/** Sync in-memory AppState after profile name is saved (Settings / API). */
function applyProfileNameToAppState(name) {
  const n = String(name || '').trim();
  AppState.userName = n;
  AppState.userInitials = n.split(/\s+/).filter(Boolean).map((x) => x[0]).join('').toUpperCase().substring(0, 2);
  if (typeof KitchenStore !== 'undefined') {
    const d = KitchenStore.getData();
    d.userName = AppState.userName;
    d.userInitials = AppState.userInitials;
    KitchenStore.saveData(d);
  }
}
window.applyProfileNameToAppState = applyProfileNameToAppState;

// ─── Sidebar navigation ─────────────────────────────────────────
function initSidebar() {
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  const navItems = document.querySelectorAll('.nav-item[data-page]');
  navItems.forEach(item => {
    const page = item.dataset.page;
    if (currentPage === page || (currentPage === '' && page === 'index.html')) {
      item.classList.add('active');
    }
    item.addEventListener('click', () => {
      window.location.href = page;
    });
  });
}

// ─── Toast notifications ───────────────────────────────────────
function showToast(message, type = 'success', duration = 3000) {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toastIcon = { success: 'check', error: 'xOctagon', warning: 'alert', info: 'info' };
  const key = toastIcon[type] || 'info';
  const ico =
    typeof getUiIconHtml === 'function'
      ? `<span class="toast-ico" aria-hidden="true">${getUiIconHtml(key)}</span>`
      : '';
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `${ico}<span class="toast-msg">${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'toast-out 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ─── Modal helpers ─────────────────────────────────────────────
function openModal(id) {
  const overlay = document.getElementById(id);
  if (overlay) overlay.classList.add('open');
}

function closeModal(id) {
  const overlay = document.getElementById(id);
  if (overlay) overlay.classList.remove('open');
}

function setupModals() {
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.classList.remove('open');
    });
  });
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.modal-overlay').classList.remove('open');
    });
  });
}

// ─── Notification badge update ─────────────────────────────────
function updateNotifBadge(count) {
  const badge = document.querySelector('.notif-badge');
  if (badge) badge.textContent = count > 99 ? '99+' : count;
}

// ─── Logout ───────────────────────────────────────────────────
function initLogout() {
  document.querySelectorAll('.logout-btn').forEach((logoutBtn) => {
    if (logoutBtn.classList.contains('sk-logout-btn')) return;
    logoutBtn.addEventListener('click', () => {
      showToast('Logging out...', 'info', 1500);
      localStorage.removeItem('isLoggedIn');
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 1600);
    });
  });
}

// ─── Back button ──────────────────────────────────────────────
function initBackBtn() {
  const backBtn = document.querySelector('.back-btn');
  if (backBtn) {
    backBtn.addEventListener('click', () => history.back());
  }
}

// ─── Counter animation ─────────────────────────────────────────
function animateCounters() {
  document.querySelectorAll('[data-count]').forEach(el => {
    const target = parseFloat(el.dataset.count);
    const prefix = el.dataset.prefix || '';
    const suffix = el.dataset.suffix || '';
    const duration = 1200;
    const steps = 40;
    let step = 0;
    const tick = setInterval(() => {
      step++;
      const progress = step / steps;
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = target * eased;
      el.textContent = prefix + (Number.isInteger(target) ? Math.round(current) : current.toFixed(1)) + suffix;
      if (step >= steps) { clearInterval(tick); el.textContent = prefix + target + suffix; }
    }, duration / steps);
  });
}

// ─── Shared Notifications Panel (injected into every page) ───
let _notifFilter = 'all';

function injectNotificationPanel() {
  // Don't inject if page already has its own panel (e.g. sustainability)
  if (document.getElementById('notifications-panel')) return;

  const panel = document.createElement('div');
  panel.className = 'modal-overlay';
  panel.id = 'notifications-panel';
  panel.innerHTML = `
    <div class="modal" style="max-width:400px;max-height:80vh">
      <div class="modal-header">
        <span class="modal-title modal-title-with-icon"><span class="modal-title-ico" data-ui-icon="bell" aria-hidden="true"></span> Notifications</span>
        <button type="button" class="modal-close" aria-label="Close"><span data-ui-icon="close" aria-hidden="true"></span></button>
      </div>
      <div style="display:flex;gap:0.5rem;margin-bottom:1rem" id="notif-chips">
        <button class="chip active" onclick="filterNotifs('all',this)">All</button>
        <button class="chip" onclick="filterNotifs('alerts',this)">Alerts</button>
        <button class="chip" onclick="filterNotifs('ai',this)">AI</button>
        <button class="chip" onclick="filterNotifs('achievements',this)">Achievements</button>
      </div>
      <div id="notif-list" style="max-height:55vh;overflow-y:auto"></div>
      <div style="text-align:center;padding-top:0.75rem;border-top:1px solid var(--border);margin-top:0.75rem">
        <button class="btn btn-sm btn-outline" onclick="clearNotifs()">Mark all as read</button>
      </div>
    </div>
  `;
  document.body.appendChild(panel);
  if (typeof injectUiIcons === 'function') injectUiIcons();
}

function toggleNotifications() {
  const panel = document.getElementById('notifications-panel');
  if (!panel) return;
  panel.classList.toggle('open');
  if (panel.classList.contains('open')) renderNotifs();
}

function filterNotifs(type, btn) {
  _notifFilter = type;
  const container = btn.parentElement;
  container.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  renderNotifs();
}

function renderNotifs() {
  const list = document.getElementById('notif-list');
  if (!list) return;
  let data = AppState.notifData;
  if (_notifFilter !== 'all') data = data.filter(n => n.type === _notifFilter);

  list.innerHTML = data.map(n => `
    <div style="display:flex;align-items:flex-start;gap:0.7rem;padding:0.75rem 0.5rem;border-radius:8px;
      margin-bottom:0.25rem;transition:all 0.2s;cursor:pointer;
      background:${n.unread?'var(--green-light)':'transparent'}"
      onmouseenter="this.style.background='var(--green-light)'" onmouseleave="this.style.background='${n.unread?'var(--green-light)':'transparent'}'">
      <span class="notif-row-ico" aria-hidden="true">${typeof getUiIconHtml === 'function' ? getUiIconHtml(n.iconKey || 'info') : ''}</span>
      <div style="flex:1">
        <div style="font-size:0.84rem;font-weight:${n.unread?'600':'400'};color:var(--text-dark);line-height:1.45">${n.text}</div>
        <div style="font-size:0.72rem;color:var(--text-muted);margin-top:0.15rem">${n.time}</div>
      </div>
      ${n.unread?'<div style="width:8px;height:8px;border-radius:50%;background:var(--green);flex-shrink:0;margin-top:6px"></div>':''}
    </div>
  `).join('');
}

function clearNotifs() {
  AppState.notifData.forEach(n => n.unread = false);
  const badge = document.querySelector('.notif-badge');
  if (badge) badge.textContent = '0';
  renderNotifs();
  showToast('All notifications marked as read', 'success');
}

// ─── Initialize everything ─────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  if (typeof initKitchenSync === 'function') {
    await initKitchenSync();
    if (typeof KitchenStore !== 'undefined') {
      Object.assign(AppState, KitchenStore.getData());
    }
  }
  if (typeof injectUiIcons === 'function') injectUiIcons();
  initSidebar();
  updateUserInfoUI();
  injectNotificationPanel();
  setupModals();
  initLogout();
  initBackBtn();
  updateNotifBadge(AppState.notifications);
  animateCounters();

  // Wire up all notif-btn clicks to toggleNotifications
  document.querySelectorAll('.notif-btn').forEach(btn => {
    btn.onclick = (e) => { e.stopPropagation(); toggleNotifications(); };
  });
});
