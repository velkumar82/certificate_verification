document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('register-form');
  const alertBox = document.getElementById('alert-box');
  const submitBtn = document.getElementById('submit-btn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAlert(alertBox);
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating account…';

    const payload = {
      full_name: document.getElementById('full_name').value.trim(),
      email: document.getElementById('email').value.trim(),
      phone: document.getElementById('phone').value.trim(),
      organization_name: document.getElementById('organization_name').value.trim(),
      organization_website: document.getElementById('organization_website').value.trim(),
      password: document.getElementById('password').value
    };

    try {
      await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      window.location.href = '/portal.html';
    } catch (err) {
      showAlert(alertBox, err.message, 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Create Account';
    }
  });
});
