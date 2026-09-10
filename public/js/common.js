// Small shared helpers used across applicant-facing pages.

function showAlert(container, message, type) {
  if (!container) return;
  container.innerHTML = `<div class="alert alert-${type}">${escapeHtml(message)}</div>`;
}

function clearAlert(container) {
  if (container) container.innerHTML = '';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    credentials: 'include',
    headers: options.body instanceof FormData
      ? undefined
      : { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  let data = {};
  try { data = await res.json(); } catch (e) { /* no body */ }
  if (!res.ok) {
    const err = new Error(data.message || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function statusBadgeClass(status) {
  const key = (status || 'Pending').toLowerCase().replace(/\s+/g, '_');
  return `badge badge-${key}`;
}

function formatDate(dt) {
  if (!dt) return '—';
  const d = new Date(dt);
  if (isNaN(d.getTime())) return dt;
  return d.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
}
