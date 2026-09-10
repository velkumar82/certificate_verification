document.addEventListener('DOMContentLoaded', async () => {
  const alertBox = document.getElementById('alert-box');
  const welcomeName = document.getElementById('welcome-name');
  const regSubtitle = document.getElementById('reg-subtitle');
  const content = document.getElementById('content');
  const alreadyVerified = document.getElementById('already-verified');
  const submissionGrid = document.getElementById('applicant-submission');
  const verifiedSummary = document.getElementById('verified-summary');
  const downloadPdfLink = document.getElementById('download-pdf-link');
  const certFileLink = document.getElementById('certificate-file-link');
  const paymentLink = document.getElementById('payment-screenshot-link');
  const verifiedCertLink = document.getElementById('verified-certificate-link');
  const verifiedPaymentLink = document.getElementById('verified-payment-link');
  const form = document.getElementById('verify-form');
  const submitBtn = document.getElementById('submit-verify-btn');

  const params = new URLSearchParams(window.location.search);
  const certificateId = params.get('id');

  if (!certificateId) {
    showAlert(alertBox, 'No request specified.', 'error');
    return;
  }

  // ---- auth check ----
  try {
    const { coe } = await apiFetch('/api/coe/me');
    welcomeName.textContent = `Welcome, ${coe.verifier_name}`;
  } catch (err) {
    window.location.href = '/coe/login.html';
    return;
  }

  function kv(label, value, muted) {
    return `<div class="kv-item"><div class="k">${escapeHtml(label)}</div><div class="v${muted ? ' muted' : ''}">${value != null && String(value).trim() ? escapeHtml(String(value)) : '—'}</div></div>`;
  }

  try {
    const { request, coeDefaults } = await apiFetch(`/api/coe/requests/${certificateId}`);

    regSubtitle.textContent = `Register Number: ${request.register_number} · ${request.student_name}`;

    submissionGrid.innerHTML = [
      kv('Register Number', request.register_number),
      kv('Applicant Name', request.student_name),
      kv('Year of Passing', request.year_of_passing),
      kv('Organization Name', request.organization_name),
      kv('Organization Website', request.organization_website),
      kv('Payment ID', request.payment_id),
      kv('Submitted On', request.submitted_at, true),
      kv('Current Status', request.status)
    ].join('');

    certFileLink.href = `/api/coe/requests/${certificateId}/certificate-file`;
    paymentLink.href = `/api/coe/requests/${certificateId}/payment-screenshot`;

    if (request.status === 'Verified' || request.status === 'Rejected') {
      // Already verified — show summary instead of the form.
      content.classList.add('hidden');
      alreadyVerified.classList.remove('hidden');

      verifiedSummary.innerHTML = [
        kv('Verification Status', request.verification_status),
        kv('Verification Reference', request.verification_reference),
        kv('Verifier Name', request.v_verifier_name),
        kv('Designation & Department', request.designation_department),
        kv('Date of Confirmation', request.confirmation_date),
        kv('Father Name', request.father_name),
        kv('Department', request.department),
        kv('College Name', request.college_name),
        kv('Study Mode', request.study_mode),
        kv('CGPA', request.cgpa),
        kv('Division', request.division),
        kv('Organization Name', request.organization_name),
        kv('Organization Website', request.organization_website),
        kv('Feedback', request.feedback, true)
      ].join('');

      if (request.pdf_file) {
        downloadPdfLink.href = `/api/coe/verifications/${certificateId}/pdf`;
      } else {
        downloadPdfLink.classList.add('hidden');
      }
      verifiedCertLink.href = `/api/coe/requests/${certificateId}/certificate-file`;
      verifiedPaymentLink.href = `/api/coe/requests/${certificateId}/payment-screenshot`;
    } else {
      content.classList.remove('hidden');

      // Pre-fill verifier fields from the logged-in COE account.
      if (coeDefaults) {
        document.getElementById('verifier_name').value = coeDefaults.verifier_name || '';
        document.getElementById('designation_department').value =
          [coeDefaults.designation, coeDefaults.department].filter(Boolean).join(', ');
        document.getElementById('contact_details').value = coeDefaults.contact_details || '';
      }
      document.getElementById('confirmation_date').value = new Date().toISOString().slice(0, 10);
    }
  } catch (err) {
    showAlert(alertBox, 'Failed to load request: ' + err.message, 'error');
    return;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAlert(alertBox);

    const statusEl = form.querySelector('input[name="verification_status"]:checked');
    if (!statusEl) {
      showAlert(alertBox, 'Please select Verified or Rejected.', 'error');
      return;
    }

    const payload = {
      verifier_name: document.getElementById('verifier_name').value.trim(),
      designation_department: document.getElementById('designation_department').value.trim(),
      confirmation_date: document.getElementById('confirmation_date').value,
      contact_details: document.getElementById('contact_details').value.trim(),
      father_name: document.getElementById('father_name').value.trim(),
      department: document.getElementById('department').value.trim(),
      college_name: document.getElementById('college_name').value.trim(),
      study_mode: document.getElementById('study_mode').value,
      cgpa: document.getElementById('cgpa').value.trim(),
      division: document.getElementById('division').value.trim(),
      feedback: document.getElementById('feedback').value.trim(),
      verification_status: statusEl.value
    };

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span> Submitting…';

    try {
      const result = await apiFetch(`/api/coe/verifications/${certificateId}`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      showAlert(alertBox, `Request ${payload.verification_status.toLowerCase()} successfully. Reference: ${result.verificationReference}`, 'success');
      setTimeout(() => { window.location.href = '/coe/dashboard.html'; }, 1400);
    } catch (err) {
      showAlert(alertBox, err.message, 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Verification';
    }
  });
});
