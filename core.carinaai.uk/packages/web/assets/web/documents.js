(function () {
  const API = '/api/documents';
  const AUTO_SAVE_MS = 2000;

  const docListEl = document.getElementById('doc-list');
  const emptyStateEl = document.getElementById('empty-state');
  const editorPanelEl = document.getElementById('editor-panel');
  const titleEl = document.getElementById('doc-title');
  const formatEl = document.getElementById('doc-format');
  const editorEl = document.getElementById('editor');
  const previewPaneEl = document.getElementById('preview-pane');
  const previewEl = document.getElementById('preview');
  const editorWrapEl = document.getElementById('editor-wrap');
  const wordCountEl = document.getElementById('word-count');
  const saveStatusEl = document.getElementById('save-status');
  const assistPanelEl = document.getElementById('assist-panel');
  const assistInstructionEl = document.getElementById('assist-instruction');
  const assistPreviewEl = document.getElementById('assist-preview');
  const assistAcceptBtn = document.getElementById('assist-accept');
  const assistDiscardBtn = document.getElementById('assist-discard');

  let documents = [];
  let activeId = null;
  let dirty = false;
  let autoSaveTimer = null;
  let previewOpen = false;
  let pendingSuggestion = null;
  let pendingSuggestionMode = null;

  if (typeof marked !== 'undefined') {
    if (typeof marked.use === 'function') {
      marked.use({ breaks: true, gfm: true });
    } else {
      marked.setOptions({ breaks: true, gfm: true });
    }
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function wordCount(text) {
    const trimmed = String(text || '').trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).length;
  }

  function updateWordCount() {
    wordCountEl.textContent = wordCount(editorEl.value) + ' words';
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

  function renderList() {
    if (!documents.length) {
      docListEl.innerHTML =
        '<div style="padding:2.5rem 1rem;text-align:center;color:var(--muted)">' +
        '<div style="font-size:1rem;font-weight:600;margin-bottom:0.5rem">No documents yet</div>' +
        '<div style="font-size:0.8rem;line-height:1.5">Click <strong>New doc</strong> or ask Carina:<br>' +
        '"draft a project brief for my new app"</div>' +
        '</div>';
      return;
    }
    docListEl.innerHTML = documents.map((doc) => {
      const active = doc.id === activeId ? ' active' : '';
      const when = new Date(doc.updatedAt).toLocaleString();
      return '<button type="button" class="doc-item' + active + '" data-id="' + escapeHtml(doc.id) + '">' +
        '<div class="title">' + escapeHtml(doc.title) + '</div>' +
        '<div class="meta"><span class="badge">' + escapeHtml(doc.format) + '</span> ' + escapeHtml(when) + '</div>' +
        '</button>';
    }).join('');
    docListEl.querySelectorAll('.doc-item').forEach((btn) => {
      btn.addEventListener('click', () => openDocument(btn.getAttribute('data-id')));
    });
  }

  function showEditor(show) {
    emptyStateEl.hidden = show;
    editorPanelEl.hidden = !show;
  }

  function renderPreview() {
    const format = formatEl.value;
    const text = editorEl.value;
    if (format === 'markdown' && typeof marked !== 'undefined') {
      previewEl.innerHTML = marked.parse(text);
      previewEl.querySelectorAll('pre code').forEach((block) => {
        if (typeof hljs !== 'undefined') hljs.highlightElement(block);
      });
      return;
    }
    if (format === 'html') {
      previewEl.textContent = '';
      const frame = document.createElement('div');
      frame.innerHTML = text;
      previewEl.appendChild(frame);
      return;
    }
    previewEl.innerHTML = '<pre style="white-space:pre-wrap;">' + escapeHtml(text) + '</pre>';
  }

  function scheduleAutoSave() {
    dirty = true;
    setSaveStatus('Unsaved changes');
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
      if (activeId && dirty) saveDocument(false);
    }, AUTO_SAVE_MS);
  }

  async function loadDocuments() {
    const data = await api('GET', '');
    documents = data.documents || [];
    renderList();
  }

  async function openDocument(id) {
    if (!id) return;
    if (dirty && activeId) await saveDocument(false);
    const doc = await api('GET', '/' + encodeURIComponent(id));
    activeId = doc.id;
    titleEl.value = doc.title;
    formatEl.value = doc.format;
    editorEl.value = doc.content;
    dirty = false;
    pendingSuggestion = null;
    assistPreviewEl.hidden = true;
    assistAcceptBtn.hidden = true;
    assistDiscardBtn.hidden = true;
    showEditor(true);
    renderList();
    updateWordCount();
    if (previewOpen) renderPreview();
    setSaveStatus('Loaded');
  }

  async function createDocument() {
    const doc = await api('POST', '', { title: 'Untitled', content: '', format: 'markdown' });
    documents.unshift({
      id: doc.id,
      title: doc.title,
      format: doc.format,
      updatedAt: doc.updatedAt,
    });
    await openDocument(doc.id);
    editorEl.focus();
  }

  async function saveDocument(manual) {
    if (!activeId) return;
    const payload = {
      title: titleEl.value,
      content: editorEl.value,
      format: formatEl.value,
    };
    const doc = await api('PUT', '/' + encodeURIComponent(activeId), payload);
    dirty = false;
    const idx = documents.findIndex((d) => d.id === activeId);
    if (idx >= 0) {
      documents[idx] = {
        id: doc.id,
        title: doc.title,
        format: doc.format,
        updatedAt: doc.updatedAt,
      };
    }
    renderList();
    setSaveStatus(manual ? 'Saved' : 'Auto-saved');
  }

  async function deleteDocument() {
    if (!activeId) return;
    if (!confirm('Delete this document?')) return;
    await api('DELETE', '/' + encodeURIComponent(activeId));
    documents = documents.filter((d) => d.id !== activeId);
    activeId = null;
    dirty = false;
    showEditor(false);
    renderList();
    setSaveStatus('');
  }

  function exportDocument() {
    if (!activeId) return;
    const format = formatEl.value;
    const ext = format === 'markdown' ? 'md' : format === 'html' ? 'html' : format === 'csv' ? 'csv' : 'txt';
    const blob = new Blob([editorEl.value], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (titleEl.value || 'document').replace(/[^\w.-]+/g, '_') + '.' + ext;
    a.click();
    URL.revokeObjectURL(url);
  }

  function getSelectionText() {
    const start = editorEl.selectionStart;
    const end = editorEl.selectionEnd;
    if (start === end) return '';
    return editorEl.value.slice(start, end);
  }

  function applySuggestionToEditor(suggestion, mode) {
    if (mode === 'selection') {
      const start = editorEl.selectionStart;
      const end = editorEl.selectionEnd;
      if (start !== end) {
        editorEl.value = editorEl.value.slice(0, start) + suggestion + editorEl.value.slice(end);
        editorEl.selectionStart = start;
        editorEl.selectionEnd = start + suggestion.length;
      }
    } else {
      editorEl.value = suggestion;
    }
    updateWordCount();
    if (previewOpen) renderPreview();
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
      content: editorEl.value,
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

  editorEl.addEventListener('input', () => {
    updateWordCount();
    if (previewOpen) renderPreview();
    scheduleAutoSave();
  });

  titleEl.addEventListener('input', scheduleAutoSave);
  formatEl.addEventListener('change', () => {
    if (previewOpen) renderPreview();
    scheduleAutoSave();
  });

  document.getElementById('new-doc').addEventListener('click', () => createDocument().catch(showError));
  document.getElementById('save-doc').addEventListener('click', () => saveDocument(true).catch(showError));
  document.getElementById('export-doc').addEventListener('click', exportDocument);
  document.getElementById('delete-doc').addEventListener('click', () => deleteDocument().catch(showError));

  document.getElementById('toggle-preview').addEventListener('click', () => {
    previewOpen = !previewOpen;
    previewPaneEl.hidden = !previewOpen;
    editorWrapEl.classList.toggle('split', previewOpen);
    if (previewOpen) renderPreview();
  });

  document.getElementById('toggle-assist').addEventListener('click', () => {
    assistPanelEl.classList.toggle('open');
  });

  document.getElementById('assist-selection').addEventListener('click', () => requestAssist('selection').catch(showError));
  document.getElementById('assist-full').addEventListener('click', () => requestAssist('full').catch(showError));

  assistAcceptBtn.addEventListener('click', () => {
    if (!pendingSuggestion) return;
    applySuggestionToEditor(pendingSuggestion, pendingSuggestionMode);
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

  // Show skeleton while documents load
  docListEl.innerHTML = [1, 2, 3, 4].map(() =>
    '<div class="skeleton" style="height:56px;margin-bottom:6px;"></div>',
  ).join('');

  loadDocuments().catch(showError);
})();
