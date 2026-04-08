/* ============================================================
   SMART KITCHEN – JavaScript
   ============================================================ */

// ─── Navbar scroll effect ────────────────────────────────────
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 30);
});

// ─── Hamburger menu ──────────────────────────────────────────
const hamburger = document.getElementById('hamburger');
const navLinks  = document.getElementById('nav-links');

hamburger.addEventListener('click', () => {
  navLinks.classList.toggle('open');
  hamburger.classList.toggle('active');
});

// ─── Scroll-triggered animations ─────────────────────────────
const animatedEls = document.querySelectorAll('.animate-on-scroll');

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
);

animatedEls.forEach((el) => observer.observe(el));

// ─── Counter animation ────────────────────────────────────────
function animateCounter(el) {
  const target   = parseInt(el.dataset.target, 10);
  const divisor  = parseFloat(el.dataset.divisor || 1);
  const suffix   = el.dataset.suffix || '';
  const duration = 1800;
  const steps    = 60;
  const increment = target / steps;
  let current = 0;
  let step    = 0;

  const tick = () => {
    step++;
    current += increment;
    if (step >= steps) {
      const val = (target / divisor);
      el.textContent = Number.isInteger(val) ? `${val}${suffix}` : `${val.toFixed(1)}${suffix}`;
      return;
    }
    const val = (current / divisor);
    el.textContent = Number.isInteger(val) ? `${val}${suffix}` : `${val.toFixed(1)}${suffix}`;
    const eased = Math.pow(step / steps, 0.5);
    setTimeout(tick, duration / steps / eased);
  };
  tick();
}

const counterEls = document.querySelectorAll('.stat-number');
const counterObs = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        counterObs.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.5 }
);
counterEls.forEach((el) => counterObs.observe(el));

// ─── Smooth active nav link ───────────────────────────────────
const sections = document.querySelectorAll('section[id]');
const navLinkEls = document.querySelectorAll('.nav-link');

window.addEventListener('scroll', () => {
  let current = '';
  sections.forEach((sec) => {
    const top = sec.offsetTop - 90;
    if (window.scrollY >= top) current = sec.getAttribute('id');
  });
  navLinkEls.forEach((link) => {
    link.style.color = '';
    if (link.getAttribute('href') === `#${current}`) {
      link.style.color = 'var(--green-primary)';
    }
  });
});

// ─── Chat FAB ripple effect ───────────────────────────────────
const chatFab = document.getElementById('chat-fab');
chatFab.addEventListener('click', () => {
  chatFab.style.transform = 'scale(0.9)';
  setTimeout(() => (chatFab.style.transform = ''), 150);
});

// ─── Stat cards stagger on hover parent ──────────────────────
document.querySelectorAll('.stat-card, .feature-card, .info-card').forEach((card) => {
  card.addEventListener('mouseenter', function () {
    this.style.transition = 'all 0.25s cubic-bezier(0.4,0,0.2,1)';
  });
});

// ─── Hero particle trail (cursor glow) ───────────────────────
const hero = document.querySelector('.hero');
if (hero) {
  let lastTime = 0;
  hero.addEventListener('mousemove', (e) => {
    const now = Date.now();
    if (now - lastTime < 40) return;
    lastTime = now;

    const dot = document.createElement('div');
    const rect = hero.getBoundingClientRect();
    dot.style.cssText = `
      position:absolute;
      left:${e.clientX - rect.left}px;
      top:${e.clientY - rect.top}px;
      width:8px; height:8px;
      border-radius:50%;
      background:rgba(26,158,92,0.35);
      pointer-events:none;
      transform:translate(-50%,-50%) scale(1);
      transition: opacity 0.7s ease, transform 0.7s ease;
      z-index:1;
    `;
    hero.appendChild(dot);
    requestAnimationFrame(() => {
      dot.style.opacity = '0';
      dot.style.transform = 'translate(-50%,-50%) scale(3)';
    });
    setTimeout(() => dot.remove(), 700);
  });
}

// ─── Auth State Management ────────────────────────────────────
const btnDashboard = document.getElementById('btn-dashboard');
const heroStartBtn = document.getElementById('hero-start-btn');
const isLoggedIn =
  !!localStorage.getItem('authToken') || localStorage.getItem('isLoggedIn') === 'true';

if (isLoggedIn) {
  if (btnDashboard) btnDashboard.style.display = 'inline-block';
  if (heroStartBtn) {
    heroStartBtn.innerHTML = `Go to Dashboard <span class="btn-arrow" data-ui-icon="chevronRight" aria-hidden="true"></span>`;
    if (typeof injectUiIcons === 'function') injectUiIcons();
    heroStartBtn.href = 'dashboard.html';
  }
}

// ─── Subscription Buttons Redirection ──────────────────────────
const pricingBtns = document.querySelectorAll('.pricing-btn');
pricingBtns.forEach(btn => {
  btn.href = isLoggedIn ? 'dashboard.html' : 'auth.html';
});

// ─── Logout logic ──────────────────────────────────────────────
const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('userName');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('sk_profile_user_id');
    window.location.href = 'index.html';
  });
}

document.addEventListener('DOMContentLoaded', () => {
  if (typeof injectUiIcons === 'function') injectUiIcons();
});

console.log('SmartKitchen loaded');
