/* Shopkeeper session (localStorage) — shared by dashboard + deals pages */

function getShopkeeperSession() {
  try {
    const raw = localStorage.getItem('shopkeeperSession');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function shopkeeperLogout() {
  localStorage.removeItem('shopkeeperSession');
  localStorage.removeItem('userRole');
  window.location.href = 'shopkeeper-auth.html';
}

function initShopkeeperShell() {
  const sk = getShopkeeperSession();
  if (!sk) return;
  document.querySelectorAll('.sk-user-name').forEach((el) => {
    el.textContent = sk.name || 'Shopkeeper';
  });
  document.querySelectorAll('.sk-user-avatar').forEach((el) => {
    const n = sk.name || 'SK';
    el.textContent = n
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  });
  document.querySelectorAll('.sk-logout-btn').forEach((btn) => {
    btn.addEventListener('click', shopkeeperLogout);
  });
}

window.getShopkeeperSession = getShopkeeperSession;
window.shopkeeperLogout = shopkeeperLogout;
window.initShopkeeperShell = initShopkeeperShell;
