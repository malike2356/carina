(function () {
  const form = document.getElementById('research-form');
  const queryEl = document.getElementById('research-query');
  const outputEl = document.getElementById('research-output');
  const progressEl = document.getElementById('research-progress');
  const statusEl = document.getElementById('status');
  const submitBtn = document.getElementById('research-submit');
  const historyEl = document.getElementById('research-history');
  const citeEl = document.getElementById('research-cite');
  const actionsEl = document.getElementById('research-actions');
  const copyCiteBtn = document.getElementById('research-copy-cite');
  const openDocBtn = document.getElementById('research-open-doc');
  const continueBtn = document.getElementById('research-continue');

  let activeReport = null;

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

  function renderMarkdown(text) {
    if (typeof marked !== 'undefined') {
      outputEl.innerHTML = marked.parse(text);
      outputEl.classList.add('markdown-body');
      outputEl.classList.remove('empty-output');
      return;
    }
    outputEl.textContent = text;
    outputEl.classList.remove('empty-output');
  }

  function setActiveReport(meta, markdown, query) {
    activeReport = {
      id: meta.id,
      shareId: meta.shareId,
      title: meta.title,
      query: query || meta.query,
      markdown: markdown,
      openUrl: meta.openUrl || ('/research?open=' + meta.shareId),
    };
    if (citeEl) {
      citeEl.hidden = false;
      citeEl.textContent = 'Cite: ' + window.location.origin + activeReport.openUrl;
    }
    if (actionsEl) actionsEl.hidden = false;
    statusEl.textContent = (meta.sourceCount || 0) + ' sources';
  }

  function clearActiveReport() {
    activeReport = null;
    if (citeEl) citeEl.hidden = true;
    if (actionsEl) actionsEl.hidden = true;
  }

  async function fetchReports() {
    const res = await fetch('/api/research/reports?limit=20');
    if (!res.ok) return [];
    const data = await res.json().catch(function () { return { reports: [] }; });
    return data.reports || [];
  }

  async function loadReport(idOrShare) {
    const res = await fetch('/api/research/reports/' + encodeURIComponent(idOrShare));
    if (!res.ok) throw new Error('Report not found');
    const data = await res.json();
    queryEl.value = data.meta.query || '';
    renderMarkdown(data.markdown || '');
    setActiveReport(data.meta, data.markdown, data.meta.query);
    if (progressEl) progressEl.textContent = '';
    statusEl.textContent = 'Loaded saved report';
  }

  function renderHistory(reports) {
    if (!historyEl) return;
    if (!reports.length) {
      historyEl.innerHTML = '';
      return;
    }
    historyEl.innerHTML = '<div class="research-history-label">Saved research</div>' +
      reports.map(function (item) {
        const when = new Date(item.createdAt || item.updatedAt).toLocaleString();
        return '<button type="button" class="history-item" data-id="' + escapeHtml(item.shareId || item.id) + '">' +
          '<span class="title">' + escapeHtml(item.title || item.query) + '</span>' +
          '<span class="meta">' + escapeHtml(when) + ' | ' + escapeHtml(String(item.sourceCount || 0)) + ' sources</span>' +
          '</button>';
      }).join('');

    historyEl.querySelectorAll('.history-item').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const id = btn.getAttribute('data-id');
        if (!id) return;
        loadReport(id).catch(function (err) {
          statusEl.textContent = 'Error';
          outputEl.textContent = err.message;
        });
      });
    });
  }

  async function refreshHistory() {
    try {
      renderHistory(await fetchReports());
    } catch {
      renderHistory([]);
    }
  }

  async function runResearch(query) {
    submitBtn.disabled = true;
    statusEl.textContent = 'Researching...';
    outputEl.classList.remove('empty-output');
    outputEl.innerHTML = '';
    clearActiveReport();
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
          renderMarkdown(data.markdown || '');
          if (data.saved) {
            setActiveReport(data.saved, data.markdown || '', query);
          } else {
            statusEl.textContent = (data.sourceCount || 0) + ' sources';
          }
          refreshHistory();
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
      outputEl.classList.add('empty-output');
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

  if (copyCiteBtn) {
    copyCiteBtn.addEventListener('click', function () {
      if (!activeReport) return;
      const cite = window.location.origin + activeReport.openUrl;
      navigator.clipboard.writeText(cite).then(function () {
        statusEl.textContent = 'Cite link copied';
      }).catch(function () {
        prompt('Copy cite link:', cite);
      });
    });
  }

  if (openDocBtn) {
    openDocBtn.addEventListener('click', function () {
      if (!activeReport) return;
      const target = '/documents?fromResearch=' + encodeURIComponent(activeReport.shareId || activeReport.id);
      window.location.href = target;
    });
  }

  if (continueBtn) {
    continueBtn.addEventListener('click', function () {
      if (!activeReport) return;
      const followUp = 'Follow up on: ' + (activeReport.title || activeReport.query);
      queryEl.value = followUp;
      queryEl.focus();
      statusEl.textContent = 'Edit the follow-up question, then run research';
    });
  }

  const params = new URLSearchParams(window.location.search);
  const openId = params.get('open');
  refreshHistory().then(function () {
    if (openId) {
      loadReport(openId).catch(function (err) {
        statusEl.textContent = 'Could not open report';
        outputEl.textContent = err.message;
      });
    }
  });
})();
