/* Shopkeeper register / login → API */

const API = '/api/shopkeepers';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('sk-auth-form');
  const subtitle = document.getElementById('auth-subtitle');
  const nameGroup = document.getElementById('sk-name-group');
  const phoneGroup = document.getElementById('sk-phone-group');
  const shopGroup = document.getElementById('sk-shop-group');
  const addressGroup = document.getElementById('sk-address-group');
  const licenseGroup = document.getElementById('sk-license-group');
  const toggleText = document.getElementById('sk-toggle-text');
  const btnText = document.getElementById('sk-btn-text');
  const loading = document.getElementById('sk-loading-overlay');
  const feedback = document.getElementById('sk-auth-feedback');
  const submitBtn = document.getElementById('sk-submit-btn');

  let isLogin = false;

  function bindToggle() {
    const el = document.getElementById('sk-toggle-auth');
    if (el) el.addEventListener('click', onToggle);
  }

  function onToggle(e) {
    e.preventDefault();
    isLogin = !isLogin;
    form.reset();
    clearErrors();
    hideFeedback();

    const extraGroups = [nameGroup, phoneGroup, shopGroup, addressGroup, licenseGroup];
    if (isLogin) {
      subtitle.textContent = 'Welcome back — sign in to manage your deals.';
      extraGroups.forEach((g) => {
        if (g) g.style.display = 'none';
      });
      btnText.textContent = 'Sign in';
      toggleText.innerHTML = 'New shopkeeper? <a href="#" id="sk-toggle-auth">Create an account</a>';
    } else {
      subtitle.textContent = 'Create a shopkeeper account to list near-expiry deals for local shoppers.';
      extraGroups.forEach((g) => {
        if (g) g.style.display = 'block';
      });
      btnText.textContent = 'Create shopkeeper account';
      toggleText.innerHTML = 'Already registered? <a href="#" id="sk-toggle-auth">Sign in</a>';
    }
    bindToggle();
  }

  bindToggle();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validate()) return;

    const email = document.getElementById('sk-email').value.trim();
    const password = document.getElementById('sk-password').value;

    showLoading(true);
    hideFeedback();

    try {
      if (isLogin) {
        const res = await fetch(`${API}/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Sign in failed');
        persistSession(data.shopkeeper);
        showFeedback('Signed in. Redirecting…', 'success');
        setTimeout(() => {
          window.location.href = 'shopkeeper-dashboard.html';
        }, 600);
      } else {
        const body = {
          name: document.getElementById('sk-name').value.trim(),
          email,
          password,
          phone: document.getElementById('sk-phone').value.trim(),
          shopName: document.getElementById('sk-shop').value.trim(),
          shopAddress: document.getElementById('sk-address').value.trim(),
          licenseOrGst: document.getElementById('sk-license').value.trim(),
        };
        const res = await fetch(`${API}/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Registration failed');
        persistSession(data.shopkeeper);
        showFeedback('Account created. Redirecting…', 'success');
        setTimeout(() => {
          window.location.href = 'shopkeeper-dashboard.html';
        }, 600);
      }
    } catch (err) {
      showFeedback(err.message || 'Something went wrong', 'error');
    } finally {
      showLoading(false);
    }
  });

  function persistSession(shopkeeper) {
    localStorage.setItem('shopkeeperSession', JSON.stringify(shopkeeper));
    localStorage.setItem('userRole', 'shopkeeper');
  }

  function validate() {
    let ok = true;
    clearErrors();

    const email = document.getElementById('sk-email').value.trim();
    const password = document.getElementById('sk-password').value;
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRe.test(email)) {
      setGroupError('sk-email', true);
      ok = false;
    }
    if (password.length < 8) {
      setGroupError('sk-password', true);
      ok = false;
    }

    if (!isLogin) {
      if (!document.getElementById('sk-name').value.trim()) {
        setGroupError('sk-name', true);
        ok = false;
      }
      if (!document.getElementById('sk-phone').value.trim()) {
        setGroupError('sk-phone', true);
        ok = false;
      }
      if (!document.getElementById('sk-shop').value.trim()) {
        setGroupError('sk-shop', true);
        ok = false;
      }
    }

    return ok;
  }

  function setGroupError(inputId, show) {
    const input = document.getElementById(inputId);
    const group = input && input.closest('.form-group');
    if (group) group.classList.toggle('has-error', show);
  }

  function clearErrors() {
    document.querySelectorAll('#sk-auth-form .form-group').forEach((g) => g.classList.remove('has-error'));
  }

  function showLoading(on) {
    loading.style.display = on ? 'flex' : 'none';
    submitBtn.disabled = on;
  }

  function showFeedback(msg, type) {
    feedback.textContent = msg;
    feedback.className = `form-feedback ${type}`;
    feedback.style.display = 'block';
  }

  function hideFeedback() {
    feedback.style.display = 'none';
  }
});
