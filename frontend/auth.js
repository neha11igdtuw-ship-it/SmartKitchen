/* ============================================================
   SMART KITCHEN – Auth (household login / register → API + JWT)
   ============================================================ */

const AUTH_API = '/api/auth';

document.addEventListener('DOMContentLoaded', () => {
  const authForm = document.getElementById('auth-form');
  const authSubtitle = document.getElementById('auth-subtitle');
  const nameGroup = document.getElementById('name-group');
  const toggleText = document.getElementById('toggle-text');
  const submitBtn = document.getElementById('submit-btn');
  const btnText = document.getElementById('btn-text');
  const loadingOverlay = document.getElementById('loading-overlay');
  const feedback = document.getElementById('auth-feedback');
  const countryGroup = document.getElementById('country-group');
  const countrySel = document.getElementById('auth-country');

  let isLogin = false;

  if (typeof window.fillCountrySelect === 'function' && countrySel) {
    window.fillCountrySelect(countrySel, '');
  }

  function bindToggle() {
    const t = document.getElementById('toggle-auth');
    if (t) t.addEventListener('click', handleToggleClick);
  }

  function handleToggleClick(e) {
    e.preventDefault();
    isLogin = !isLogin;

    authForm.reset();
    clearErrors();
    hideFeedback();

    if (isLogin) {
      authSubtitle.textContent = 'Welcome back! Please sign in.';
      nameGroup.style.display = 'none';
      if (countryGroup) countryGroup.style.display = 'none';
      if (countrySel) countrySel.removeAttribute('required');
      btnText.textContent = 'Sign In';
      toggleText.innerHTML = `Don't have an account? <a href="#" id="toggle-auth">Sign up</a>`;
    } else {
      authSubtitle.textContent = 'Create your account to get started.';
      nameGroup.style.display = 'block';
      if (countryGroup) countryGroup.style.display = 'block';
      if (countrySel) countrySel.setAttribute('required', 'required');
      btnText.textContent = 'Create Account';
      toggleText.innerHTML = `Already have an account? <a href="#" id="toggle-auth">Sign in</a>`;
    }
    bindToggle();
  }

  bindToggle();

  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    showLoading(true);
    hideFeedback();

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const name = (document.getElementById('name').value || '').trim();

    const rememberMe = document.getElementById('auth-remember')?.checked ?? true;
    const path = isLogin ? '/login' : '/register';
    const country = countrySel ? countrySel.value.trim() : '';
    const body = isLogin
      ? { email, password, rememberMe }
      : { name: name || 'Member', email, password, country, rememberMe };

    try {
      const res = await fetch(AUTH_API + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        showFeedback(data.error || (isLogin ? 'Sign in failed' : 'Registration failed'), 'error');
        showLoading(false);
        return;
      }

      const token = data.token;
      const user = data.user;
      if (!token || !user) {
        showFeedback('Unexpected response from server', 'error');
        showLoading(false);
        return;
      }

      localStorage.setItem('authToken', token);
      localStorage.setItem('isLoggedIn', 'true');
      localStorage.setItem('userName', user.name || '');
      localStorage.setItem('userEmail', user.email || '');
      localStorage.setItem('userCountry', user.country || '');
      if (user.id) {
        const prevKitchenId = localStorage.getItem('sk_kitchen_user_id');
        const mongoId = user.id;
        if (prevKitchenId && prevKitchenId !== mongoId) {
          try {
            await fetch('/api/data/migrate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ fromUserId: prevKitchenId, toUserId: mongoId }),
            });
          } catch (_) {
            /* non-fatal */
          }
        }
        localStorage.setItem('sk_profile_user_id', mongoId);
        localStorage.setItem('sk_kitchen_user_id', mongoId);
      }

      showFeedback(
        `Successfully ${isLogin ? 'signed in' : 'registered'}! Redirecting to dashboard...`,
        'success'
      );
      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 900);
    } catch (err) {
      console.error(err);
      showFeedback('Could not reach the server. Is the backend running?', 'error');
      showLoading(false);
    }
  });

  function validateForm() {
    let valid = true;
    clearErrors();

    const nameInput = document.getElementById('name');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');

    if (!isLogin && nameInput.value.trim().length === 0) {
      setError('name-group', true);
      valid = false;
    }

    if (!isLogin && countrySel && !countrySel.value) {
      setError('country-group', true);
      valid = false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailInput.value)) {
      setError('email', true, 'email-error');
      valid = false;
    }

    if (passwordInput.value.length < 8) {
      setError('password', true, 'password-error');
      valid = false;
    }

    return valid;
  }

  function setError(elementId, show) {
    const group = document.getElementById(elementId).closest('.form-group');
    if (show) group.classList.add('has-error');
    else group.classList.remove('has-error');
  }

  function clearErrors() {
    document.querySelectorAll('.form-group').forEach((group) => {
      group.classList.remove('has-error');
    });
  }

  function showLoading(show) {
    loadingOverlay.style.display = show ? 'flex' : 'none';
    submitBtn.disabled = show;
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
