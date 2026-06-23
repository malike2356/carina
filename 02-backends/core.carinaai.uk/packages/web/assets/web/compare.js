(function () {
  const STORAGE_KEY = 'carina:compare-sessions';
  const form = document.getElementById('compare-form');
  const queryEl = document.getElementById('compare-query');
  const blindEl = document.getElementById('compare-blind');
  const gridEl = document.getElementById('compare-grid');
  const statusEl = document.getElementById('status');
  const submitBtn = document.getElementById('compare-submit');
  const revealBtn = document.getElementById('compare-reveal');
  const openDocBtn = document.getElementById('compare-open-doc');
  const historyEl = document.getElementById('compare-history');
  const providerPickerEl = document.getElementById('provider-picker');

  let blindActive = false;
  let pendingReveal = null;
  let lastResultMarkdown = '';
  let lastPrompt = '';
  let configuredProviders = [];
  let responseItems = [];

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function loadHistory() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  }

  function saveHistory(entry) {
    const items = loadHistory().filter(function (item) { return item.prompt !== entry.prompt; });
    items.unshift(entry);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, 8)));
    renderHistory();
  }

  function renderHistory() {
    if (!historyEl) return;
    const items = loadHistory();
    if (!items.length) {
      historyEl.innerHTML = '';
      return;
    }
    historyEl.innerHTML = '<div class="compare-history-label">Recent</div>' + items.map(function (item) {
      return '<button type="button" class="history-chip" data-prompt="' + escapeHtml(item.prompt) + '">' +
        escapeHtml(item.prompt.slice(0, 48)) + (item.prompt.length > 48 ? '...' : '') +
        '</button>';
    }).join('');
    historyEl.querySelectorAll('.history-chip').forEach(function (btn) {
      btn.addEventListener('click', function () {
        queryEl.value = btn.getAttribute('data-prompt') || '';
        queryEl.focus();
      });
    });
  }

  function selectedProviders() {
    if (!providerPickerEl) return configuredProviders.slice(0, 3);
    const checked = Array.from(providerPickerEl.querySelectorAll('input[type="checkbox"]:checked'))
      .map(function (input) { return input.value; });
    return checked.length ? checked : configuredProviders.slice(0, 3);
  }

  function renderProviderPicker(providers) {
    configuredProviders = providers;
    if (!providerPickerEl) return;
    if (!providers.length) {
      providerPickerEl.innerHTML = '<span class="empty-output">No configured providers. Add API keys in Settings.</span>';
      return;
    }
    providerPickerEl.innerHTML = providers.map(function (name, index) {
      const checked = index < 3 ? ' checked' : '';
      return '<label class="provider-chip"><input type="checkbox" value="' + escapeHtml(name) + '"' + checked + '> ' +
        escapeHtml(name) + '</label>';
    }).join('');
  }

  async function loadProviders() {
    try {
      const res = await fetch('/api/compare/providers');
      if (!res.ok) return;
      const data = await res.json();
      renderProviderPicker(data.providers || []);
    } catch {
      renderProviderPicker([]);
    }
  }

  function cardHtml(label, body, meta, loading) {
    return '<article class="compare-card' + (loading ? ' loading' : '') + '">' +
      '<header><strong>' + escapeHtml(label) + '</strong>' +
      (meta ? '<span class="meta">' + escapeHtml(meta) + '</span>' : '') +
      '</header>' +
      '<div class="compare-body">' + (loading ? '<span class="skeleton" style="display:block;height:72px"></span>' : escapeHtml(body)) +
      '</div></article>';
  }

  function initGrid(count) {
    gridEl.innerHTML = '';
    responseItems = [];
    for (let i = 0; i < count; i += 1) {
      const label = blindActive ? 'Provider ' + String.fromCharCode(65 + i) : 'Waiting...';
      gridEl.insertAdjacentHTML('beforeend', cardHtml(label, '', 'Starting', true));
    }
  }

  function updateCard(index, label, body, meta) {
    const cards = gridEl.querySelectorAll('.compare-card');
    const card = cards[index];
    if (!card) return;
    card.classList.remove('loading');
    card.querySelector('header strong').textContent = label;
    const metaEl = card.querySelector('header .meta');
    if (metaEl) metaEl.textContent = meta || '';
    card.querySelector('.compare-body').textContent = body;
  }

  function revealProviderLabels() {
    responseItems.forEach(function (item, index) {
      if (!item) return;
      const label = item.providerId + ' (' + item.model + ')';
      const meta = item.error
        ? 'error'
        : ((item.latencyMs / 1000).toFixed(1) + 's' + (item.tokenCount ? ' | ' + item.tokenCount + ' tokens' : ''));
      const body = item.error ? ('Error: ' + item.error) : (item.response || '');
      updateCard(index, label, body, meta);
    });
    if (revealBtn) revealBtn.hidden = true;
    blindActive = false;
  }

  async function runCompare(query) {
    blindActive = Boolean(blindEl && blindEl.checked);
    pendingReveal = null;
    lastResultMarkdown = '';
    lastPrompt = query;
    responseItems = [];
    if (revealBtn) revealBtn.hidden = true;
    if (openDocBtn) openDocBtn.hidden = true;
    submitBtn.disabled = true;
    statusEl.textContent = 'Comparing...';
    gridEl.innerHTML = '';

    const providers = selectedProviders();
    if (!providers.length) {
      throw new Error('Select at least one configured provider.');
    }

    const url = '/api/compare/stream?prompt=' + encodeURIComponent(query) +
      '&providers=' + encodeURIComponent(providers.join(',')) +
      (blindActive ? '&blind=1' : '');

    const res = await fetch(url);
    if (!res.ok) {
      const err = await res.json().catch(function () { return {}; });
      throw new Error(err.error || 'Compare failed');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() || '';

      parts.forEach(function (block) {
        const line = block.split('\n').find(function (row) { return row.startsWith('data: '); });
        if (!line) return;
        const payload = line.slice(6).trim();
        if (payload === '[DONE]') return;
        let data;
        try { data = JSON.parse(payload); } catch { return; }

        if (data.type === 'start') {
          initGrid(data.providers || providers.length);
        }
        if (data.type === 'response') {
          const item = data.item || {};
          responseItems[data.index] = item;
          const meta = item.error
            ? 'error'
            : ((item.latencyMs / 1000).toFixed(1) + 's' + (item.tokenCount ? ' | ' + item.tokenCount + ' tokens' : ''));
          const body = item.error ? ('Error: ' + item.error) : (item.response || '');
          updateCard(data.index, data.label, body, meta);
        }
        if (data.type === 'done') {
          lastResultMarkdown = data.markdown || '';
          if (blindActive && revealBtn) {
            pendingReveal = lastResultMarkdown;
            revealBtn.hidden = false;
          }
          if (openDocBtn && lastResultMarkdown) {
            openDocBtn.hidden = false;
          }
        }
        if (data.type === 'error') throw new Error(data.error || 'Compare failed');
      });
    }

    statusEl.textContent = 'Done';
    saveHistory({ prompt: query, at: new Date().toISOString() });
  }

  async function openCompareInDocument() {
    if (!lastResultMarkdown) return;
    const title = 'Compare: ' + (lastPrompt.slice(0, 48) || 'results');
    const res = await fetch('/api/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title,
        content: lastResultMarkdown,
        format: 'markdown',
      }),
    });
    const data = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(data.error || 'Could not create document');
    window.location.href = '/documents?open=' + encodeURIComponent(data.id);
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    const query = queryEl.value.trim();
    if (!query) return;
    runCompare(query).catch(function (err) {
      statusEl.textContent = 'Error';
      gridEl.innerHTML = '<p class="empty-output">' + escapeHtml(err.message) + '</p>';
    }).finally(function () {
      submitBtn.disabled = false;
    });
  });

  if (revealBtn) {
    revealBtn.addEventListener('click', function () {
      revealProviderLabels();
      pendingReveal = null;
    });
  }

  if (openDocBtn) {
    openDocBtn.addEventListener('click', function () {
      openCompareInDocument().catch(function (err) {
        statusEl.textContent = 'Error';
        alert(err.message);
      });
    });
  }

  renderHistory();
  loadProviders();
})();
