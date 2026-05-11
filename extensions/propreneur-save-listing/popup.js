(function () {
  const ext = typeof browser !== 'undefined' ? browser : chrome;

  const apiBaseEl = document.getElementById('apiBase');
  const tokenEl = document.getElementById('token');
  const strategyEl = document.getElementById('strategy');
  const statusEl = document.getElementById('status');

  ext.storage.sync.get(['apiBase', 'token', 'strategy'], function (data) {
    if (data.apiBase) {
      apiBaseEl.value = data.apiBase;
    }
    if (data.token) {
      tokenEl.value = data.token;
    }
    if (data.strategy) {
      strategyEl.value = data.strategy;
    }
  });

  document.getElementById('storeBtn').addEventListener('click', function () {
    ext.storage.sync.set({
      apiBase: apiBaseEl.value.trim(),
      token: tokenEl.value.trim(),
      strategy: strategyEl.value,
    }, function () {
      statusEl.textContent = 'Settings saved in this browser.';
    });
  });

  document.getElementById('saveBtn').addEventListener('click', function () {
    statusEl.textContent = '';
    const base = apiBaseEl.value.trim().replace(/\/$/, '');
    const token = tokenEl.value.trim();
    if (!base || !token) {
      statusEl.textContent = 'Set API base URL and token first (then Remember settings).';

      return;
    }

    ext.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      const tab = tabs[0];
      if (!tab || !tab.url) {
        statusEl.textContent = 'No active tab URL.';

        return;
      }
      const u = tab.url;
      if (!/^https?:\/\//i.test(u)) {
        statusEl.textContent = 'This tab URL cannot be sent (not http/https).';

        return;
      }

      statusEl.textContent = 'Saving…';

      fetch(base + '/api/deal-extension-capture', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + token,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: u,
          strategy: strategyEl.value,
        }),
      })
        .then(function (r) {
          return r.json().then(function (body) {
            return { ok: r.ok, status: r.status, body: body };
          });
        })
        .then(function (res) {
          if (res.ok && res.body && res.body.data) {
            const d = res.body.data;
            if (d.deal_url) {
              statusEl.innerHTML = 'Created draft. <a target="_blank" rel="noopener" href="' + d.deal_url + '">Open deal</a>';
            } else {
              statusEl.textContent = JSON.stringify(res.body);
            }
          } else {
            statusEl.textContent = (res.body && (res.body.message || res.body.error)) || ('HTTP ' + res.status);
          }
        })
        .catch(function (e) {
          statusEl.textContent = 'Network error: ' + (e && e.message ? e.message : String(e));
        });
    });
  });
})();
