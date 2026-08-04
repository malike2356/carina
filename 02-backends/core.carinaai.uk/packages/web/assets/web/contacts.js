(function () {
  const API = '/api/contacts';
  const initialSearchParams = new URLSearchParams(window.location.search);
  const initialQuery = initialSearchParams.get('q') || '';

  let contacts = [];
  let sources = [];
  let activeId = null;
  let filter = 'all';
  let query = initialQuery.trim().toLowerCase();

  const statusEl = document.getElementById('status');
  const summaryEl = document.getElementById('summary');
  const listEl = document.getElementById('list');
  const searchEl = document.getElementById('search');
  const detailPanelEl = document.getElementById('detail-panel');
  const emptyStateEl = document.getElementById('empty-state');
  const detailNameEl = document.getElementById('detail-name');
  const detailMetaEl = document.getElementById('detail-meta');
  const fieldStatusEl = document.getElementById('field-status');
  const sourceListEl = document.getElementById('source-list');
  const fieldNameEl = document.getElementById('field-name');
  const fieldRoleEl = document.getElementById('field-role');
  const fieldSourceEl = document.getElementById('field-source');
  const fieldEmailEl = document.getElementById('field-email');
  const fieldPhoneEl = document.getElementById('field-phone');
  const fieldWhatsappEl = document.getElementById('field-whatsapp');
  const fieldTelegramEl = document.getElementById('field-telegram');
  const fieldTagsEl = document.getElementById('field-tags');
  const fieldNotesEl = document.getElementById('field-notes');
  const saveBtn = document.getElementById('save-btn');
  const deleteBtn = document.getElementById('delete-btn');
  const copyGoogleBtn = document.getElementById('copy-google-btn');

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function setStatus(text) {
    statusEl.textContent = text || '';
  }

  function setFieldStatus(text) {
    fieldStatusEl.textContent = text || '';
  }

  function setActive(contactId) {
    activeId = contactId;
    const contact = contacts.find((item) => item.id === activeId) || null;
    fillForm(contact);
    renderList();
  }

  function blankContact() {
    return {
      id: '',
      name: '',
      role: '',
      email: '',
      phone: '',
      whatsapp: '',
      telegram: '',
      tags: [],
      notes: '',
      source: 'manual',
    };
  }

  function fillForm(contact) {
    const current = contact || blankContact();
    if (!contact) {
      detailNameEl.textContent = 'New contact';
      detailMetaEl.textContent = 'Create a local or Google contact.';
      emptyStateEl.hidden = true;
      detailPanelEl.classList.add('open');
      saveBtn.textContent = 'Create';
      deleteBtn.disabled = true;
      copyGoogleBtn.hidden = true;
      fieldSourceEl.disabled = false;
    } else {
      detailNameEl.textContent = current.name;
      detailMetaEl.textContent = [
        current.source || 'manual',
        current.email || current.phone || 'No primary channel',
        current.resourceName || current.id,
      ].filter(Boolean).join(' | ');
      emptyStateEl.hidden = true;
      detailPanelEl.classList.add('open');
      saveBtn.textContent = 'Save';
      deleteBtn.disabled = false;
      fieldSourceEl.disabled = true;
      copyGoogleBtn.hidden = current.source === 'google';
    }

    fieldNameEl.value = current.name || '';
    fieldRoleEl.value = current.role || '';
    fieldSourceEl.value = current.source === 'google' ? 'google' : 'manual';
    fieldEmailEl.value = current.email || '';
    fieldPhoneEl.value = current.phone || '';
    fieldWhatsappEl.value = current.whatsapp || current.phone || '';
    fieldTelegramEl.value = current.telegram || '';
    fieldTagsEl.value = Array.isArray(current.tags) ? current.tags.join(', ') : '';
    fieldNotesEl.value = current.notes || '';
    setFieldStatus(contact ? 'Loaded' : 'Ready for a new contact.');
  }

  function currentPayload() {
    return {
      name: fieldNameEl.value.trim(),
      role: fieldRoleEl.value.trim(),
      email: fieldEmailEl.value.trim(),
      phone: fieldPhoneEl.value.trim(),
      whatsapp: fieldWhatsappEl.value.trim(),
      telegram: fieldTelegramEl.value.trim(),
      tags: fieldTagsEl.value
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      notes: fieldNotesEl.value.trim(),
    };
  }

  function filteredContacts() {
    return contacts.filter((contact) => {
      if (filter !== 'all' && contact.source !== filter) return false;
      if (!query) return true;
      const haystack = [
        contact.name,
        contact.role,
        contact.email,
        contact.phone,
        contact.whatsapp,
        contact.telegram,
        contact.notes,
        (contact.tags || []).join(' '),
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(query);
    }).sort((a, b) => a.name.localeCompare(b.name));
  }

  function setQuery(rawQuery) {
    const next = rawQuery.trim();
    query = next.toLowerCase();
    if (searchEl.value !== next) {
      searchEl.value = next;
    }
    const url = new URL(window.location.href);
    if (next) url.searchParams.set('q', next);
    else url.searchParams.delete('q');
    window.history.replaceState({}, '', url.toString());
  }

  function renderSources() {
    if (!sources.length) {
      sourceListEl.innerHTML = '<div class="source-card"><strong>No synced stores</strong>Connect Google Contacts or add manual entries.</div>';
      return;
    }
    sourceListEl.innerHTML = sources.map((source) => (
      '<div class="source-card"><strong>' + escapeHtml(source.name) + '</strong>' +
      escapeHtml(String(source.count)) + ' records' +
      (source.lastModified ? '<br>' + escapeHtml(new Date(source.lastModified).toLocaleString()) : '') +
      '</div>'
    )).join('');
  }

  function renderSummary() {
    const total = contacts.length;
    const manualCount = contacts.filter((contact) => contact.source === 'manual').length;
    const googleCount = contacts.filter((contact) => contact.source === 'google').length;
    summaryEl.textContent = total + ' contact' + (total === 1 ? '' : 's') +
      ' | ' + manualCount + ' manual' +
      ' | ' + googleCount + ' Google';
  }

  function renderList() {
    const visible = filteredContacts();
    listEl.innerHTML = '';

    if (!visible.length) {
      listEl.innerHTML = '<div style="padding:2rem 1rem;text-align:center;color:var(--muted)">No contacts match the current filter.</div>';
      return;
    }

    for (const contact of visible) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'item' + (contact.id === activeId ? ' active' : '');
      button.innerHTML =
        '<div class="item-head"><span class="item-name">' + escapeHtml(contact.name) + '</span>' +
        '<span class="chip ' + escapeHtml(contact.source || 'manual') + '">' + escapeHtml(contact.source || 'manual') + '</span></div>' +
        '<div class="item-meta">' +
        escapeHtml(contact.role || 'No role') +
        '<br>' +
        escapeHtml(contact.email || contact.phone || contact.whatsapp || contact.telegram || 'No email or phone') +
        '</div>';
      button.addEventListener('click', () => setActive(contact.id));
      listEl.appendChild(button);
    }
  }

  async function request(method, path, body) {
    const res = await fetch(API + path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || ('Request failed: ' + res.status));
    }
    return data;
  }

  async function loadContacts() {
    setStatus('Loading...');
    const data = await request('GET', '');
    contacts = data.contacts || [];
    sources = data.sources || [];
    renderSummary();
    renderSources();
    renderList();
    setStatus(data.counts ? String(data.counts.contacts) + ' loaded' : '');

    if (activeId && !contacts.some((contact) => contact.id === activeId)) {
      activeId = null;
      fillForm(null);
    }
    if (!activeId && contacts.length && fieldNameEl.value.trim() === '') {
      fillForm(null);
    }
    if (!activeId && query) {
      const visible = filteredContacts();
      if (visible.length) {
        setActive(visible[0].id);
      }
    }
  }

  async function saveContact() {
    const payload = currentPayload();
    if (!payload.name) {
      alert('Name is required.');
      return;
    }

    try {
      setFieldStatus('Saving...');
      let saved;
      if (!activeId) {
        if (fieldSourceEl.value === 'google') {
          saved = await request('POST', '/google/contact', payload);
        } else {
          saved = await request('POST', '/manual', payload);
        }
        activeId = saved.contact.id;
      } else {
        saved = await request('PATCH', '/' + encodeURIComponent(activeId), payload);
      }
      await loadContacts();
      setActive(saved.contact.id);
      setFieldStatus('Saved');
    } catch (err) {
      setFieldStatus(err.message);
    }
  }

  async function deleteContact() {
    if (!activeId) return;
    if (!confirm('Delete this contact?')) return;
    try {
      await request('DELETE', '/' + encodeURIComponent(activeId));
      activeId = null;
      await loadContacts();
      fillForm(null);
      renderList();
      setFieldStatus('Deleted');
    } catch (err) {
      setFieldStatus(err.message);
    }
  }

  async function syncGoogleContacts() {
    try {
      setStatus('Syncing Google Contacts...');
      const result = await request('POST', '/google', {});
      setStatus('Imported ' + result.imported + ' contacts');
      await loadContacts();
    } catch (err) {
      setStatus(err.message);
    }
  }

  async function copyToGoogle() {
    if (!activeId) return;
    const payload = currentPayload();
    if (!payload.name) {
      alert('Name is required.');
      return;
    }
    try {
      setFieldStatus('Copying to Google...');
      const result = await request('POST', '/google/contact', payload);
      if (!result.contact) throw new Error('Google contact was not created');
      await loadContacts();
      setActive(result.contact.id);
      setFieldStatus('Copied to Google');
    } catch (err) {
      setFieldStatus(err.message);
    }
  }

  function newContact() {
    activeId = null;
    fillForm(null);
    renderList();
    fieldNameEl.focus();
  }

  searchEl.addEventListener('input', () => {
    setQuery(searchEl.value);
    renderList();
  });

  document.getElementById('refresh-btn').addEventListener('click', () => {
    loadContacts().catch((err) => setStatus(err.message));
  });

  document.getElementById('sync-btn').addEventListener('click', () => {
    syncGoogleContacts().catch((err) => setStatus(err.message));
  });

  document.getElementById('new-btn').addEventListener('click', newContact);
  saveBtn.addEventListener('click', () => {
    saveContact().catch((err) => setFieldStatus(err.message));
  });
  deleteBtn.addEventListener('click', () => {
    deleteContact().catch((err) => setFieldStatus(err.message));
  });
  copyGoogleBtn.addEventListener('click', () => {
    copyToGoogle().catch((err) => setFieldStatus(err.message));
  });

  document.getElementById('filters').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-filter]');
    if (!button) return;
    filter = button.dataset.filter || 'all';
    for (const item of document.querySelectorAll('#filters button[data-filter]')) {
      item.classList.toggle('active', item === button);
    }
    renderList();
  });

  for (const input of [fieldNameEl, fieldRoleEl, fieldEmailEl, fieldPhoneEl, fieldWhatsappEl, fieldTelegramEl, fieldTagsEl, fieldNotesEl]) {
    input.addEventListener('input', () => {
      setFieldStatus('Unsaved changes');
    });
  }

  searchEl.value = initialQuery;
  fillForm(null);
  loadContacts().catch((err) => {
    setStatus(err.message);
    summaryEl.textContent = 'Unable to load contacts';
    listEl.innerHTML = '<div style="padding:2rem 1rem;text-align:center;color:var(--muted)">' + escapeHtml(err.message) + '</div>';
  });
})();
