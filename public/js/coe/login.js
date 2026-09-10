document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('coe-login-form');
  const alertBox = document.getElementById('alert-box');
  const submitBtn = document.getElementById('submit-btn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAlert(alertBox);
    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing in…';

    const user_id = document.getElementById('user_id').value.trim();
    const password = document.getElementById('password').value;

    try {
      await apiFetch('/api/coe/login', {
        method: 'POST',
        body: JSON.stringify({ user_id, password })
      });
      window.location.href = '/coe/dashboard.html';
    } catch (err) {
      showAlert(alertBox, err.message, 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign In';
    }
  });
});
