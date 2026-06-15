(function () {
  const STORAGE_KEY = 'carina:research-sessions';
  const form = document.getElementById('research-form');
  const queryEl = document.getElementById('research-query');
  const outputEl = document.getElementById('research-output');
  const progressEl = document.getElementById('research-progress');
  const statusEl = document.getElementById('status');
  const submitBtn = document.getElementById('research-submit');
  const historyEl = document.getElementById('research-history');

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

  function loadSessions() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  }

  function saveSession(entry) {
    const items = loadSessions().filter(function (item) { return item.id !== entry.id; });
    items.unshift(entry);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, 12)));
    renderHistory();
  }

  function renderMarkdown(text) {
    if (typeof marked !== 'undefined') {
      outputEl.innerHTML = marked.parse(text);
      outputEl.classList.add('markdown-body');
      return;
    }
    outputEl.textContent = text;
  }

  function renderHistory() {
    if (!historyEl) return;
    const items = loadSessions();
    if (!items.length) {
      historyEl.innerHTML = '';
      return;
    }
    historyEl.innerHTML = '<div class="research-history-label">Recent research</div>' +
      items.map(function (item) {
        return '<button type="button" class="history-item" data-id="' + escapeHtml(item.id) + '">' +
          '<span class="title">' + escapeHtml(item.title || item.query) + '</span>' +
          '<span class="meta">' + escapeHtml(new Date(item.at).toLocaleString()) + '</span>' +
          '</button>';
      }).join('');

    historyEl.querySelectorAll('.history-item').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const id = btn.getAttribute('data-id');
        const session = loadSessions().find(function (item) { return item.id === id; });
        if (!session) return;
        queryEl.value = session.query;
        renderMarkdown(session.markdown || session.summary || '');
        statusEl.textContent = session.title || 'Loaded from history';
        if (progressEl) progressEl.textContent = '';
      });
    });
  }

  async function runResearch(query) {
    submitBtn.disabled = true;
    statusEl.textContent = 'Researching...';
    outputEl.classList.remove('empty-output');
    outputEl.innerHTML = '';
    if (progressEl) progressEl.textContent = 'Starting...';

    const url = '/api/research/stream?q=' + encodeURIComponent(query);
    const res = await fetch(url);
    if (!res.ok) {
      const err = await res.json().catch(function () { return {}; });
      throw new Error(err.error || 'Research failed');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let finalMarkdown = '';
    let finalTitle = query;

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

        if (data.type === 'progress' && progressEl) {
          progressEl.textContent = data.line;
        }
        if (data.type === 'done') {
          finalMarkdown = data.markdown || '';
          finalTitle = data.title || query;
          renderMarkdown(finalMarkdown);
          saveSession({
            id: String(Date.now()),
            query: query,
            title: finalTitle,
            markdown: finalMarkdown,
            summary: data.summary || '',
            at: data.generatedAt || new Date().toISOString(),
          });
          statusEl.textContent = (data.sourceCount || 0) + ' sources';
        }
        if (data.type === 'error') throw new Error(data.error || 'Research failed');
      });
    }

    if (progressEl) progressEl.textContent = '';
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    const query = queryEl.value.trim();
    if (!query) return;
    runResearch(query).catch(function (err) {
      statusEl.textContent = 'Error';
      outputEl.textContent = err.message;
    }).finally(function () {
      submitBtn.disabled = false;
    });
  });

  queryEl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      form.requestSubmit();
    }
  });

  renderHistory();
})();
