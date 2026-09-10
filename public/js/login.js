document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('login-form');
  const alertBox = document.getElementById('alert-box');
  const submitBtn = document.getElementById('submit-btn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAlert(alertBox);
    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing in…';

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    try {
      await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      window.location.href = '/portal.html';
    } catch (err) {
      showAlert(alertBox, err.message, 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign In';
    }
  });
});
