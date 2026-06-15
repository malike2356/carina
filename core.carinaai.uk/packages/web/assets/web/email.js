(function () {
  const API = '/api/email';
  let emails = [];
  let activeId = null;
  let activeStatus = 'inbox';

  const listEl = document.getElementById('email-list');
  const statusEl = document.getElementById('status');
  const searchEl = document.getElementById('search');
  const emptyEl = document.getElementById('detail-empty');
  const contentEl = document.getElementById('detail-content');
  const subjectEl = document.getElementById('detail-subject');
  const metaEl = document.getElementById('detail-meta');
  const bodyEl = document.getElementById('detail-body');

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  async function api(method, path, body) {
    const res = await fetch(API + path, {
      method: method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 204) return null;
    const data = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(data.error || ('Request failed: ' + res.status));
    return data;
  }

  function urgencyBadge(urgency) {
    const cls = urgency === 'high' ? 'high' : urgency === 'low' ? 'low' : 'normal';
    return '<span class="badge ' + cls + '">' + escapeHtml(urgency || 'normal') + '</span>';
  }

  function renderList() {
    listEl.innerHTML = '';
    if (!emails.length) {
      listEl.innerHTML =
        '<div style="padding:2.5rem 1rem;text-align:center;color:var(--muted)">' +
        '<div style="font-size:1rem;font-weight:600;margin-bottom:0.5rem">No emails</div>' +
        '<div style="font-size:0.79rem;line-height:1.55">' +
        'Set <code>IMAP_HOST</code> in .env and click <strong>Sync IMAP</strong>,<br>' +
        'or connect a Resend inbound webhook at<br><code>/webhooks/email/inbound</code></div>' +
        '</div>';
      return;
    }
    emails.forEach(function (email) {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'email-item' + (email.id === activeId ? ' active' : '') + (email.read ? '' : ' unread');
      item.innerHTML =
        '<div class="email-subject">' + urgencyBadge(email.urgency) + escapeHtml(email.subject || '(no subject)') + '</div>' +
        '<div class="email-meta">' + escapeHtml(email.from_address) + ' | ' +
        escapeHtml(new Date(email.received_at).toLocaleString()) + '</div>';
      item.addEventListener('click', function () { openEmail(email.id); });
      listEl.appendChild(item);
    });
  }

  function openDetail(email) {
    emptyEl.style.display = 'none';
    contentEl.classList.add('open');
    subjectEl.textContent = email.subject || '(no subject)';
    metaEl.textContent = 'From ' + email.from_address + ' to ' + email.to_address + ' at ' +
      new Date(email.received_at).toLocaleString();
    bodyEl.textContent = email.body_text || email.preview || '(empty body)';
  }

  function closeDetail() {
    emptyEl.style.display = 'flex';
    contentEl.classList.remove('open');
    activeId = null;
  }

  async function loadEmails() {
    statusEl.textContent = 'Loading...';
    listEl.innerHTML = [1, 2, 3, 4, 5].map(() =>
      '<div class="skeleton" style="height:52px;margin-bottom:6px;border-radius:7px;"></div>',
    ).join('');
    try {
      const q = searchEl.value.trim();
      const params = new URLSearchParams({ status: activeStatus, limit: '50' });
      if (q) params.set('q', q);
      const data = await api('GET', '/?' + params.toString());
      emails = data.emails || [];
      statusEl.textContent = emails.length + ' message' + (emails.length === 1 ? '' : 's');
      if (activeId && !emails.some(function (e) { return e.id === activeId; })) closeDetail();
      renderList();
    } catch (err) {
      statusEl.textContent = '';
      listEl.innerHTML = '<div style="padding:1rem;color:var(--danger);">' + escapeHtml(err.message) + '</div>';
    }
  }

  async function openEmail(id) {
    activeId = id;
    renderList();
    try {
      const email = await api('GET', '/' + id);
      openDetail(email);
      if (!email.read) {
        await api('PATCH', '/' + id, { read: true });
        await loadEmails();
        const refreshed = emails.find(function (e) { return e.id === id; });
        if (refreshed) openDetail(refreshed);
      }
    } catch (err) {
      bodyEl.textContent = err.message;
    }
  }

  async function patchActive(patch) {
    if (!activeId) return;
    await api('PATCH', '/' + activeId, patch);
    await loadEmails();
    const email = emails.find(function (e) { return e.id === activeId; });
    if (email) openDetail(email);
  }

  document.querySelectorAll('.filter-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.filter-btn').forEach(function (el) { el.classList.remove('active'); });
      btn.classList.add('active');
      activeStatus = btn.dataset.status || 'inbox';
      closeDetail();
      loadEmails();
    });
  });

  searchEl.addEventListener('input', function () {
    clearTimeout(searchEl._timer);
    searchEl._timer = setTimeout(loadEmails, 300);
  });

  document.getElementById('mark-read').addEventListener('click', function () { patchActive({ read: true }); });
  document.querySelectorAll('[data-urgency]').forEach(function (btn) {
    btn.addEventListener('click', function () { patchActive({ urgency: btn.dataset.urgency }); });
  });
  document.getElementById('archive-btn').addEventListener('click', async function () {
    if (!activeId) return;
    await api('POST', '/' + activeId + '/archive');
    closeDetail();
    loadEmails();
  });
  document.getElementById('spam-btn').addEventListener('click', async function () {
    if (!activeId) return;
    await api('POST', '/' + activeId + '/spam');
    closeDetail();
    loadEmails();
  });
  document.getElementById('use-prompt-btn').addEventListener('click', function () {
    if (!activeId) return;
    const email = emails.find(function (e) { return e.id === activeId; });
    if (!email) return;
    const prompt = 'Triage this email and suggest a reply:\nFrom: ' + email.from_address +
      '\nSubject: ' + (email.subject || '') + '\n\n' + (email.body_text || email.preview || '');
    window.location.href = '/?prefill=' + encodeURIComponent(prompt);
  });

  var composeModal = document.getElementById('compose-modal');
  var btnCompose = document.getElementById('btn-compose');
  if (btnCompose && composeModal) {
    btnCompose.addEventListener('click', function () {
      document.getElementById('compose-to').value = '';
      document.getElementById('compose-subject').value = '';
      document.getElementById('compose-body').value = '';
      document.getElementById('compose-reply-id').value = '';
      composeModal.style.display = 'flex';
    });
  }
  var btnCancel = document.getElementById('compose-cancel');
  if (btnCancel && composeModal) {
    btnCancel.addEventListener('click', function () {
      composeModal.style.display = 'none';
    });
  }
  var composeForm = document.getElementById('compose-form');
  if (composeForm) {
    composeForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var to = document.getElementById('compose-to').value.trim();
      var subject = document.getElementById('compose-subject').value.trim();
      var text = document.getElementById('compose-body').value.trim();
      var inReplyTo = document.getElementById('compose-reply-id').value || undefined;
      fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject, text, inReplyTo }),
      })
        .then(function (r) {
          return r.ok ? r.json() : r.json().then(function (d) { throw new Error(d.error || 'Send failed'); });
        })
        .then(function () { if (composeModal) composeModal.style.display = 'none'; })
        .catch(function (err) { alert('Send failed: ' + err.message); });
    });
  }
  var btnSync = document.getElementById('btn-sync');
  if (btnSync) {
    btnSync.addEventListener('click', function () {
      statusEl.textContent = 'Syncing IMAP...';
      fetch('/api/email/sync', { method: 'POST' })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          statusEl.textContent = 'Synced ' + (d.synced || 0) + ' message(s)';
          loadEmails();
        })
        .catch(function () { statusEl.textContent = 'IMAP sync failed'; });
    });
  }
  var btnAiDraft = document.getElementById('btn-ai-draft');
  if (btnAiDraft && composeModal) {
    btnAiDraft.addEventListener('click', function () {
      if (!activeId) return;
      var email = emails.find(function (e) { return e.id === activeId; });
      statusEl.textContent = 'Generating draft...';
      fetch('/api/email/' + activeId + '/ai-draft', { method: 'POST' })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (email) {
            document.getElementById('compose-to').value = email.from_address || '';
            var subj = email.subject || '';
            document.getElementById('compose-subject').value =
              subj.toLowerCase().startsWith('re:') ? subj : ('Re: ' + subj);
            document.getElementById('compose-reply-id').value = email.message_id || '';
          }
          document.getElementById('compose-body').value = d.draft || '';
          composeModal.style.display = 'flex';
          statusEl.textContent = '';
        })
        .catch(function (err) {
          statusEl.textContent = '';
          alert('Draft failed: ' + err.message);
        });
    });
  }

  loadEmails();
})();
