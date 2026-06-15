(function () {
  async function fetchJson(path, init) {
    const res = await fetch(path, init);
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  }

  function renderTable(tbodyId, columns, rows, emptyMessage) {
    const body = document.getElementById(tbodyId);
    if (!body) return;
    if (!rows.length) {
      body.innerHTML = `<tr><td colspan="${columns.length}" class="placeholder">${CarinaOpsLayout.escapeHtml(emptyMessage || 'No rows yet.')}</td></tr>`;
      return;
    }
    body.innerHTML = rows.map((row) => {
      const cells = columns.map((col) => {
        const raw = typeof col.render === 'function' ? col.render(row) : row[col.key];
        return `<td>${CarinaOpsLayout.escapeHtml(raw ?? '-')}</td>`;
      }).join('');
      return `<tr>${cells}</tr>`;
    }).join('');
  }

  function showError(elId, message) {
    const el = document.getElementById(elId);
    if (!el) return;
    if (!message) {
      el.hidden = true;
      el.textContent = '';
      return;
    }
    el.textContent = message;
    el.hidden = false;
  }

  function bindCreateForm(formId, onSubmit) {
    const form = document.getElementById(formId);
    if (!form) return;
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      await onSubmit(new FormData(form));
    });
  }

  window.CarinaPlatform = {
    fetchJson,
    renderTable,
    showError,
    bindCreateForm,
  };
})();
