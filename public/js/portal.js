document.addEventListener('DOMContentLoaded', async () => {
  const alertBox = document.getElementById('alert-box');
  const formAlertBox = document.getElementById('form-alert-box');
  const welcomeName = document.getElementById('welcome-name');
  const requestsTbody = document.getElementById('requests-tbody');
  const requestsTable = document.getElementById('requests-table');
  const emptyState = document.getElementById('empty-state');
  const statRow = document.getElementById('stat-row');

  const newRequestCard = document.getElementById('new-request-card');
  const requestsCard = document.getElementById('requests-card');
  const newRequestBtn = document.getElementById('new-request-btn');
  const cancelRequestBtn = document.getElementById('cancel-request-btn');
  const submitForm = document.getElementById('submit-form');
  const submitBtn = document.getElementById('submit-request-btn');
  const logoutBtn = document.getElementById('logout-btn');

  // ---- auth check ----
  try {
    const { user } = await apiFetch('/api/auth/me');
    welcomeName.textContent = `Welcome, ${user.full_name}`;
  } catch (err) {
    window.location.href = '/index.html';
    return;
  }

  // ---- toggle new request form ----
  newRequestBtn.addEventListener('click', () => {
    requestsCard.classList.add('hidden');
    newRequestCard.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  cancelRequestBtn.addEventListener('click', () => {
    newRequestCard.classList.add('hidden');
    requestsCard.classList.remove('hidden');
    submitForm.reset();
    clearAlert(formAlertBox);
  });

  // ---- logout ----
  logoutBtn.addEventListener('click', async () => {
    try { await apiFetch('/api/auth/logout', { method: 'POST' }); } catch (e) { /* ignore */ }
    window.location.href = '/index.html';
  });

  // ---- load requests ----
  async function loadRequests() {
    try {
      const { requests } = await apiFetch('/api/certificates/my');
      renderStats(requests);
      renderRequests(requests);
    } catch (err) {
      showAlert(alertBox, 'Failed to load your requests: ' + err.message, 'error');
    }
  }

  function renderStats(requests) {
    const counts = { Pending: 0, 'Under Verification': 0, Verified: 0, Rejected: 0 };
    requests.forEach((r) => { if (counts[r.status] !== undefined) counts[r.status]++; });

    statRow.innerHTML = `
      <div class="stat-card"><div class="num">${requests.length}</div><div class="label">Total Requests</div></div>
      <div class="stat-card"><div class="num">${counts.Pending + counts['Under Verification']}</div><div class="label">Awaiting COE</div></div>
      <div class="stat-card"><div class="num">${counts.Verified}</div><div class="label">Verified</div></div>
      <div class="stat-card"><div class="num">${counts.Rejected}</div><div class="label">Rejected</div></div>
    `;
  }

  function renderRequests(requests) {
    if (requests.length === 0) {
      requestsTable.classList.add('hidden');
      emptyState.classList.remove('hidden');
      return;
    }
    requestsTable.classList.remove('hidden');
    emptyState.classList.add('hidden');

    requestsTbody.innerHTML = requests.map((r) => {
      const status = r.status || 'Pending';
      let pdfCell = '<span style="color: var(--muted);">—</span>';
      if (status === 'Verified' && r.pdf_file) {
        pdfCell = `<a href="/api/certificates/${r.id}/pdf" class="btn btn-ghost btn-sm">Download</a>`;
      }

      let feedbackRow = '';
      if (status === 'Rejected' && r.feedback) {
        feedbackRow = `<div class="file-note" style="margin-top:4px;">COE Feedback: ${escapeHtml(r.feedback)}</div>`;
      }

      return `
        <tr>
          <td><span class="reg-link">${escapeHtml(r.register_number)}</span>${feedbackRow}</td>
          <td>${escapeHtml(r.student_name)}</td>
          <td>${escapeHtml(String(r.year_of_passing))}</td>
          <td>${formatDate(r.submitted_at)}</td>
          <td><span class="${statusBadgeClass(status)}">${escapeHtml(status)}</span></td>
          <td>${pdfCell}</td>
        </tr>
      `;
    }).join('');
  }

  // ---- submit new request ----
  submitForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAlert(formAlertBox);
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span> Submitting…';

    try {
      const formData = new FormData(submitForm);
      await apiFetch('/api/certificates/submit', { method: 'POST', body: formData });

      submitForm.reset();
      newRequestCard.classList.add('hidden');
      requestsCard.classList.remove('hidden');
      showAlert(alertBox, 'Verification request submitted successfully. You will be notified once the COE verifies it.', 'success');
      loadRequests();
    } catch (err) {
      showAlert(formAlertBox, err.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Verification Request';
    }
  });

  loadRequests();
});
