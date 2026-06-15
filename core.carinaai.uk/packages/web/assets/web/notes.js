(function () {
  const API = '/api/notes';
  const AUTO_SAVE_MS = 2000;
  const REMINDER_REFRESH_MS = 30_000;
  const INBOX_POLL_MS = 15_000;

  let notes = [];
  let activeId = null;
  let activeFilter = 'all';
  let dirty = false;
  let autoSaveTimer = null;
  let pendingSuggestion = null;
  let pendingSuggestionMode = null;

  const activeListEl = document.getElementById('active-list');
  const doneListEl = document.getElementById('done-list');
  const doneSectionEl = document.getElementById('done-section');
  const emptyEditorEl = document.getElementById('empty-editor');
  const editorPanelEl = document.getElementById('editor-panel');
  const titleEl = document.getElementById('note-title');
  const formatEl = document.getElementById('note-format');
  const remindAtEl = document.getElementById('remind-at');
  const reminderStatusEl = document.getElementById('reminder-status');
  const editorEl = document.getElementById('editor');
  const saveStatusEl = document.getElementById('save-status');
  const assistPanelEl = document.getElementById('assist-panel');
  const assistInstructionEl = document.getElementById('assist-instruction');
  const assistPreviewEl = document.getElementById('assist-preview');
  const assistAcceptBtn = document.getElementById('assist-accept');
  const assistDiscardBtn = document.getElementById('assist-discard');
  const toastEl = document.getElementById('toast');

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function showToast(text) {
    toastEl.textContent = text;
    toastEl.style.display = 'block';
    setTimeout(() => { toastEl.style.display = 'none'; }, 5000);
  }

  function setSaveStatus(text) {
    saveStatusEl.textContent = text || '';
  }

  async function api(method, path, body) {
    const res = await fetch(API + path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 204) return null;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || ('Request failed: ' + res.status));
    return data;
  }

  function filteredNotes() {
    if (activeFilter === 'all') return notes;
    return notes.filter((n) => n.format === activeFilter);
  }

  function relativeReminder(remindAt) {
    if (!remindAt) return '';
    const diffMs = new Date(remindAt).getTime() - Date.now();
    const abs = Math.abs(diffMs);
    const mins = Math.round(abs / 60_000);
    if (diffMs >= 0) {
      if (mins < 60) return 'Due in ' + mins + ' min';
      return 'Due in ' + Math.round(mins / 60) + ' h';
    }
    if (mins < 60) return 'Overdue by ' + mins + ' min';
    return 'Overdue by ' + Math.round(mins / 60) + ' h';
  }

  function toLocalInputValue(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
      'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function fromLocalInputValue(value) {
    if (!value) return null;
    return new Date(value).toISOString();
  }

  function renderItem(note, container, doneList) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'note-item' + (note.id === activeId ? ' active' : '') + (note.done ? ' done' : '');
    btn.dataset.id = note.id;

    const checkbox = note.format === 'task'
      ? '<input type="checkbox" data-task-check="' + escapeHtml(note.id) + '"' +
        (note.done ? ' checked' : '') + ' style="margin-right:6px;">'
      : '';
    const clock = note.format === 'reminder' && note.remindAt
      ? '<span class="reminder-due' + (new Date(note.remindAt) < new Date() ? ' overdue' : '') + '">' +
        escapeHtml(relativeReminder(note.remindAt)) + '</span>'
      : '';

    btn.innerHTML =
      '<div class="note-title">' + checkbox + escapeHtml(note.title || '(untitled)') + '</div>' +
      '<div class="note-meta"><span class="badge">' + escapeHtml(note.format) + '</span> ' +
      escapeHtml(new Date(note.updatedAt).toLocaleString()) +
      (clock ? ' | ' + clock : '') +
      '</div>';

    btn.addEventListener('click', (event) => {
      if (event.target && event.target.matches('input[type="checkbox"]')) return;
      openNote(note.id);
    });

    const check = btn.querySelector('input[type="checkbox"]');
    if (check) {
      check.addEventListener('click', (event) => event.stopPropagation());
      check.addEventListener('change', () => toggleDone(note.id, check.checked));
    }

    container.appendChild(btn);
  }

  function renderLists() {
    activeListEl.innerHTML = '';
    doneListEl.innerHTML = '';
    const visible = filteredNotes();
    const active = visible.filter((n) => !(n.format === 'task' && n.done));
    const done = visible.filter((n) => n.format === 'task' && n.done);

    if (!active.length) {
      activeListEl.innerHTML = '<div style="padding:0.75rem;color:var(--muted);font-size:0.8rem;">No items.</div>';
    } else {
      active.forEach((n) => renderItem(n, activeListEl, false));
    }

    if (done.length) {
      doneSectionEl.hidden = false;
      done.forEach((n) => renderItem(n, doneListEl, true));
    } else {
      doneSectionEl.hidden = true;
    }
  }

  function updateReminderUi() {
    const isReminder = formatEl.value === 'reminder';
    remindAtEl.hidden = !isReminder;
    reminderStatusEl.hidden = !isReminder;
    if (isReminder && remindAtEl.value) {
      reminderStatusEl.textContent = relativeReminder(fromLocalInputValue(remindAtEl.value));
      reminderStatusEl.className = 'status reminder-due' +
        (new Date(fromLocalInputValue(remindAtEl.value)) < new Date() ? ' overdue' : '');
    }
  }

  function showEditor(show) {
    emptyEditorEl.hidden = show;
    editorPanelEl.hidden = !show;
  }

  function scheduleAutoSave() {
    dirty = true;
    setSaveStatus('Unsaved changes');
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
      if (activeId && dirty) saveNote(false);
    }, AUTO_SAVE_MS);
  }

  async function loadNotes() {
    const data = await api('GET', '');
    notes = data.notes || [];
    renderLists();
    updateReminderUi();
  }

  async function openNote(id) {
    if (!id) return;
    if (dirty && activeId) await saveNote(false);
    const note = await api('GET', '/' + encodeURIComponent(id));
    activeId = note.id;
    titleEl.value = note.title;
    formatEl.value = note.format;
    editorEl.value = note.body;
    remindAtEl.value = toLocalInputValue(note.remindAt);
    dirty = false;
    pendingSuggestion = null;
    assistPreviewEl.hidden = true;
    assistAcceptBtn.hidden = true;
    assistDiscardBtn.hidden = true;
    showEditor(true);
    updateReminderUi();
    renderLists();
    setSaveStatus('Loaded');
  }

  async function createNote() {
    const note = await api('POST', '', {
      title: '',
      body: '',
      format: activeFilter === 'all' ? 'note' : activeFilter,
    });
    notes.unshift(note);
    await openNote(note.id);
    titleEl.focus();
  }

  async function saveNote(manual) {
    if (!activeId) return;
    const payload = {
      title: titleEl.value,
      body: editorEl.value,
      format: formatEl.value,
      remindAt: formatEl.value === 'reminder' ? fromLocalInputValue(remindAtEl.value) : null,
    };
    const note = await api('PUT', '/' + encodeURIComponent(activeId), payload);
    const idx = notes.findIndex((n) => n.id === activeId);
    if (idx >= 0) notes[idx] = note;
    dirty = false;
    renderLists();
    updateReminderUi();
    setSaveStatus(manual ? 'Saved' : 'Auto-saved');
  }

  async function toggleDone(id, done) {
    const idx = notes.findIndex((n) => n.id === id);
    if (idx >= 0) notes[idx] = { ...notes[idx], done };
    renderLists();
    try {
      const updated = await api('PUT', '/' + encodeURIComponent(id), { done });
      if (idx >= 0) notes[idx] = updated;
      renderLists();
    } catch (err) {
      if (idx >= 0) notes[idx] = { ...notes[idx], done: !done };
      renderLists();
      showError(err);
    }
  }

  async function deleteNote() {
    if (!activeId) return;
    if (!confirm('Delete this item?')) return;
    await api('DELETE', '/' + encodeURIComponent(activeId));
    notes = notes.filter((n) => n.id !== activeId);
    activeId = null;
    dirty = false;
    showEditor(false);
    renderLists();
    setSaveStatus('');
  }

  function getSelectionText() {
    const start = editorEl.selectionStart;
    const end = editorEl.selectionEnd;
    if (start === end) return '';
    return editorEl.value.slice(start, end);
  }

  function applySuggestion(suggestion, mode) {
    if (mode === 'selection') {
      const start = editorEl.selectionStart;
      const end = editorEl.selectionEnd;
      if (start !== end) {
        editorEl.value = editorEl.value.slice(0, start) + suggestion + editorEl.value.slice(end);
      }
    } else {
      editorEl.value = suggestion;
    }
    scheduleAutoSave();
  }

  async function requestAssist(mode) {
    if (!activeId) return;
    const instruction = assistInstructionEl.value.trim();
    if (!instruction) {
      alert('Enter an instruction first.');
      return;
    }
    const selection = mode === 'selection' ? getSelectionText() : undefined;
    if (mode === 'selection' && !selection) {
      alert('Select text in the editor first.');
      return;
    }
    setSaveStatus('AI assist running...');
    const data = await api('POST', '/' + encodeURIComponent(activeId) + '/ai-assist', {
      instruction,
      selection,
      body: editorEl.value,
    });
    pendingSuggestion = data.result;
    pendingSuggestionMode = mode;
    const original = mode === 'selection' ? selection : editorEl.value;
    assistPreviewEl.hidden = false;
    assistPreviewEl.textContent = 'Original:\n' + original + '\n\nSuggested:\n' + pendingSuggestion;
    assistAcceptBtn.hidden = false;
    assistDiscardBtn.hidden = false;
    setSaveStatus('Suggestion ready');
  }

  async function pollInbox() {
    try {
      const data = await api('GET', '/inbox');
      const messages = data.messages || [];
      for (const entry of messages) {
        showToast(entry.message);
        await api('POST', '/inbox/' + encodeURIComponent(entry.noteId) + '/ack');
      }
      if (messages.length) await loadNotes();
    } catch {
      // ignore polling errors
    }
  }

  editorEl.addEventListener('keydown', (event) => {
    if (event.key === 'Tab') {
      event.preventDefault();
      const start = editorEl.selectionStart;
      const end = editorEl.selectionEnd;
      editorEl.value = editorEl.value.slice(0, start) + '  ' + editorEl.value.slice(end);
      editorEl.selectionStart = editorEl.selectionEnd = start + 2;
      scheduleAutoSave();
    }
  });

  editorEl.addEventListener('input', scheduleAutoSave);
  titleEl.addEventListener('input', scheduleAutoSave);
  formatEl.addEventListener('change', () => {
    updateReminderUi();
    scheduleAutoSave();
  });
  remindAtEl.addEventListener('change', () => {
    updateReminderUi();
    scheduleAutoSave();
  });

  document.querySelectorAll('.filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.getAttribute('data-filter') || 'all';
      renderLists();
    });
  });

  document.getElementById('new-note').addEventListener('click', () => createNote().catch(showError));
  document.getElementById('save-note').addEventListener('click', () => saveNote(true).catch(showError));
  document.getElementById('delete-note').addEventListener('click', () => deleteNote().catch(showError));
  document.getElementById('toggle-assist').addEventListener('click', () => {
    assistPanelEl.classList.toggle('open');
  });
  document.getElementById('assist-selection').addEventListener('click', () => requestAssist('selection').catch(showError));
  document.getElementById('assist-full').addEventListener('click', () => requestAssist('full').catch(showError));
  assistAcceptBtn.addEventListener('click', () => {
    if (!pendingSuggestion) return;
    applySuggestion(pendingSuggestion, pendingSuggestionMode);
    pendingSuggestion = null;
    assistPreviewEl.hidden = true;
    assistAcceptBtn.hidden = true;
    assistDiscardBtn.hidden = true;
    setSaveStatus('Suggestion applied');
  });
  assistDiscardBtn.addEventListener('click', () => {
    pendingSuggestion = null;
    assistPreviewEl.hidden = true;
    assistAcceptBtn.hidden = true;
    assistDiscardBtn.hidden = true;
    setSaveStatus('');
  });

  function showError(err) {
    console.error(err);
    alert(err instanceof Error ? err.message : String(err));
    setSaveStatus('Error');
  }

  setInterval(() => {
    renderLists();
    updateReminderUi();
  }, REMINDER_REFRESH_MS);

  setInterval(() => { void pollInbox(); }, INBOX_POLL_MS);

  loadNotes().then(() => pollInbox()).catch(showError);
})();
