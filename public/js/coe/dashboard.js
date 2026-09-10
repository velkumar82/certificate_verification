document.addEventListener('DOMContentLoaded', async () => {
  const alertBox = document.getElementById('alert-box');
  const welcomeName = document.getElementById('welcome-name');
  const tbody = document.getElementById('requests-tbody');
  const table = document.getElementById('requests-table');
  const emptyState = document.getElementById('empty-state');
  const statRow = document.getElementById('stat-row');
  const logoutBtn = document.getElementById('logout-btn');
  const tabs = document.querySelectorAll('#status-tabs button');

  let currentStatus = 'active';

  // ---- auth check ----
  try {
    const { coe } = await apiFetch('/api/coe/me');
    welcomeName.textContent = `Welcome, ${coe.verifier_name}`;
  } catch (err) {
    window.location.href = '/coe/login.html';
    return;
  }

  logoutBtn.addEventListener('click', async () => {
    try { await apiFetch('/api/coe/logout', { method: 'POST' }); } catch (e) { /* ignore */ }
    window.location.href = '/coe/login.html';
  });

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      currentStatus = tab.dataset.status;
      loadRequests();
    });
  });

  async function loadRequests() {
    try {
      const qs = currentStatus === 'active' ? '' : `?status=${encodeURIComponent(currentStatus)}`;
      const { requests } = await apiFetch(`/api/coe/requests${qs}`);
      renderStats(requests);
      renderRequests(requests);
    } catch (err) {
      showAlert(alertBox, 'Failed to load requests: ' + err.message, 'error');
    }
  }

  function renderStats(requests) {
    statRow.innerHTML = `
      <div class="stat-card"><div class="num">${requests.length}</div><div class="label">Showing</div></div>
    `;
  }

  function renderRequests(requests) {
    if (requests.length === 0) {
      table.classList.add('hidden');
      emptyState.classList.remove('hidden');
      return;
    }
    table.classList.remove('hidden');
    emptyState.classList.add('hidden');

    tbody.innerHTML = requests.map((r) => `
      <tr>
        <td><a class="reg-link" href="/coe/request.html?id=${r.id}">${escapeHtml(r.register_number)}</a></td>
        <td>${escapeHtml(r.student_name)}</td>
        <td>${escapeHtml(r.organization_name)}</td>
        <td>${escapeHtml(String(r.year_of_passing))}</td>
        <td>${formatDate(r.submitted_at)}</td>
        <td><span class="${statusBadgeClass(r.status)}">${escapeHtml(r.status)}</span></td>
      </tr>
    `).join('');
  }

  loadRequests();
});
