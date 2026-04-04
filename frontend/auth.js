/* ============================================================
   SMART KITCHEN – Auth Interaction (JS)
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
    // Select elements
    const authForm      = document.getElementById('auth-form');
    const authSubtitle  = document.getElementById('auth-subtitle');
    const nameGroup     = document.getElementById('name-group');
    const toggleAuth    = document.getElementById('toggle-auth');
    const toggleText    = document.getElementById('toggle-text');
    const submitBtn     = document.getElementById('submit-btn');
    const btnText       = document.getElementById('btn-text');
    const loadingOverlay = document.getElementById('loading-overlay');
    const feedback      = document.getElementById('auth-feedback');

    // State: starts in 'signup' mode
    let isLogin = false;

    // ─── Toggle Login/Signup Modes ────────────────────────────────
    toggleAuth.addEventListener('click', (e) => {
        e.preventDefault();
        isLogin = !isLogin;
        
        // Clear previous state
        authForm.reset();
        clearErrors();
        hideFeedback();

        if (isLogin) {
            // Switch to LOGIN
            authSubtitle.textContent = "Welcome back! Please sign in.";
            nameGroup.style.display  = "none";
            btnText.textContent      = "Sign In";
            toggleText.innerHTML     = `Don't have an account? <a href="#" id="toggle-auth">Sign up</a>`;
        } else {
            // Switch to SIGNUP
            authSubtitle.textContent = "Create your account to get started.";
            nameGroup.style.display  = "block";
            btnText.textContent      = "Create Account";
            toggleText.innerHTML     = `Already have an account? <a href="#" id="toggle-auth">Sign in</a>`;
        }

        // Re-bind the click event because we replaced innerHTML
        document.getElementById('toggle-auth').addEventListener('click', toggleAuth.click);
    });

    // ─── Form Submission Handling ────────────────────────────────
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // 1. Validate
        if (!validateForm()) return;

        // 2. Mock submission process
        showLoading(true);
        hideFeedback();

        // Simulate API delay
        setTimeout(() => {
            showLoading(false);
            
            // Success Scenario
            const nameValue = document.getElementById('name').value || "Eco Explorer";
            const emailValue = document.getElementById('email').value;
            showFeedback(`Successfully ${isLogin ? 'signed in' : 'registered'}! Redirecting to dashboard...`, 'success');
            localStorage.setItem('isLoggedIn', 'true');
            localStorage.setItem('userName', nameValue);
            localStorage.setItem('userEmail', emailValue);
            
            // Redirect after a brief moment
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1800);
        }, 1500);
    });

    // ─── Validation Helper ─────────────────────────────────────────
    function validateForm() {
        let isValid = true;
        clearErrors();

        const nameInput     = document.getElementById('name');
        const emailInput    = document.getElementById('email');
        const passwordInput = document.getElementById('password');

        // Name (only for signup)
        if (!isLogin && nameInput.value.trim().length === 0) {
            setError('name-group', true);
            isValid = false;
        }

        // Email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailInput.value)) {
            setError('email', true, 'email-error');
            isValid = false;
        }

        // Password
        if (passwordInput.value.length < 8) {
            setError('password', true, 'password-error');
            isValid = false;
        }

        return isValid;
    }

    // ─── Error/UI Helpers ──────────────────────────────────────────
    function setError(elementId, show, errorMsgId) {
        const group = document.getElementById(elementId).closest('.form-group');
        if (show) {
            group.classList.add('has-error');
        } else {
            group.classList.remove('has-error');
        }
    }

    function clearErrors() {
        document.querySelectorAll('.form-group').forEach(group => {
            group.classList.remove('has-error');
        });
    }

    function showLoading(show) {
        loadingOverlay.style.display = show ? 'flex' : 'none';
        submitBtn.disabled = show;
    }

    function showFeedback(msg, type) {
        feedback.textContent = msg;
        feedback.className   = `form-feedback ${type}`;
        feedback.style.display = 'block';
    }

    function hideFeedback() {
        feedback.style.display = 'none';
    }
});
