(function () {
  const STORAGE_KEY = 'carina:compare-sessions';
  const form = document.getElementById('compare-form');
  const queryEl = document.getElementById('compare-query');
  const blindEl = document.getElementById('compare-blind');
  const gridEl = document.getElementById('compare-grid');
  const statusEl = document.getElementById('status');
  const submitBtn = document.getElementById('compare-submit');
  const revealBtn = document.getElementById('compare-reveal');
  const historyEl = document.getElementById('compare-history');

  let blindActive = false;
  let pendingReveal = null;

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

  async function runCompare(query) {
    blindActive = Boolean(blindEl && blindEl.checked);
    pendingReveal = null;
    if (revealBtn) revealBtn.hidden = true;
    submitBtn.disabled = true;
    statusEl.textContent = 'Comparing...';
    gridEl.innerHTML = '';

    const url = '/api/compare/stream?prompt=' + encodeURIComponent(query) +
      (blindActive ? '&blind=1' : '');

    const res = await fetch(url);
    if (!res.ok) {
      const err = await res.json().catch(function () { return {}; });
      throw new Error(err.error || 'Compare failed');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let providerCount = 0;

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
          providerCount = data.providers || 3;
          initGrid(providerCount);
        }
        if (data.type === 'response') {
          const item = data.item || {};
          const meta = item.error
            ? 'error'
            : ((item.latencyMs / 1000).toFixed(1) + 's' + (item.tokenCount ? ' | ' + item.tokenCount + ' tokens' : ''));
          const body = item.error ? ('Error: ' + item.error) : (item.response || '');
          updateCard(data.index, data.label, body, meta);
        }
        if (data.type === 'done' && blindActive && revealBtn) {
          pendingReveal = data.markdown || '';
          revealBtn.hidden = false;
        }
        if (data.type === 'error') throw new Error(data.error || 'Compare failed');
      });
    }

    statusEl.textContent = 'Done';
    saveHistory({ prompt: query, at: new Date().toISOString() });
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
      blindActive = false;
      revealBtn.hidden = true;
      if (pendingReveal) {
        gridEl.innerHTML = '<pre class="compare-reveal">' + escapeHtml(pendingReveal) + '</pre>';
      }
    });
  }

  renderHistory();
})();
