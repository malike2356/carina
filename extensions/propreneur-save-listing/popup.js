(function () {
  var ext = typeof browser !== 'undefined' ? browser : chrome;

  function byId(id) {
    return document.getElementById(id);
  }

  function showState(name) {
    ['loading', 'unsupported', 'preview', 'success', 'error'].forEach(function (s) {
      var el = byId('state-' + s);
      if (!el) {
        return;
      }
      el.classList.toggle('active', s === name);
    });
  }

  function portalScriptForUrl(url) {
    var u = url.toLowerCase();
    if (u.indexOf('rightmove.co.uk') !== -1) {
      return 'rightmove';
    }
    if (u.indexOf('zoopla.co.uk') !== -1) {
      return 'zoopla';
    }
    if (u.indexOf('onthemarket.com') !== -1) {
      return 'onthemarket';
    }
    if (u.indexOf('openrent.co.uk') !== -1) {
      return 'openrent';
    }
    if (u.indexOf('spareroom.co.uk') !== -1) {
      return 'spareroom';
    }
    return null;
  }

  function postCapture(base, token, jsonBody) {
    return fetch(base + '/api/deal-extension-capture', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: jsonBody,
    }).then(function (r) {
      return r.json().then(function (j) {
        return { ok: r.ok, status: r.status, body: j };
      });
    });
  }

  ext.storage.sync.get(['apiBase', 'token', 'strategy'], function (data) {
    if (data.strategy) {
      byId('strategy').value = data.strategy;
    }
  });

  byId('openOptions').addEventListener('click', function (e) {
    e.preventDefault();
    if (ext.runtime.openOptionsPage) {
      ext.runtime.openOptionsPage();
    }
  });

  var capturedPayload = null;
  var activeTabUrl = '';

  ext.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    var tab = tabs[0];
    if (!tab || !tab.id || !tab.url) {
      showState('unsupported');
      return;
    }
    activeTabUrl = tab.url;
    if (!/^https?:\/\//i.test(activeTabUrl)) {
      showState('unsupported');
      return;
    }
    var portal = portalScriptForUrl(activeTabUrl);
    if (!portal) {
      showState('unsupported');
      return;
    }

    var files = ['content-scripts/shared.js', 'content-scripts/' + portal + '.js'];
    ext.scripting.executeScript({ target: { tabId: tab.id }, files: files }, function () {
      if (ext.runtime.lastError) {
        showState('error');
        byId('errorText').textContent = ext.runtime.lastError.message || 'Could not inject capture script.';
        return;
      }
      ext.scripting.executeScript(
        {
          target: { tabId: tab.id },
          func: function () {
            return window.__propreneurListingPayload || null;
          },
        },
        function (results) {
          var payload = results && results[0] && results[0].result ? results[0].result : null;
          if (!payload || !payload.success) {
            showState('preview');
            byId('previewTitle').textContent = 'Could not read listing from this page';
            byId('previewAddr').textContent = 'You can still send the tab URL for a server-side import.';
            byId('previewPrice').textContent = '';
            byId('previewImg').hidden = true;
            capturedPayload = null;
            byId('fallbackUrlBtn').hidden = false;
            return;
          }
          capturedPayload = payload;
          showState('preview');
          byId('previewTitle').textContent = payload.title || 'Listing';
          byId('previewAddr').textContent = payload.address || payload.postcode || '';
          byId('previewPrice').textContent = payload.price != null ? '£' + Number(payload.price).toLocaleString('en-GB') : '';
          var imgEl = byId('previewImg');
          if (payload.images && payload.images[0]) {
            imgEl.src = payload.images[0];
            imgEl.hidden = false;
          } else {
            imgEl.hidden = true;
          }
          byId('fallbackUrlBtn').hidden = false;
        },
      );
    });
  });

  byId('fallbackUrlBtn').addEventListener('click', function () {
    capturedPayload = null;
    byId('saveBtn').click();
  });

  byId('saveBtn').addEventListener('click', function () {
    byId('status').textContent = '';
    ext.storage.sync.get(['apiBase', 'token', 'strategy'], function (data) {
      var base = (data.apiBase || '').trim().replace(/\/$/, '');
      var token = (data.token || '').trim();
      var strategy = byId('strategy').value || data.strategy || 'btl';
      if (!base || !token) {
        byId('status').textContent = 'Set workspace URL and token in Options first.';
        if (ext.runtime.openOptionsPage) {
          ext.runtime.openOptionsPage();
        }
        return;
      }

      var jsonBody;
      if (capturedPayload) {
        jsonBody = JSON.stringify({ import: capturedPayload, strategy: strategy });
      } else {
        jsonBody = JSON.stringify({ url: activeTabUrl, strategy: strategy });
      }

      postCapture(base, token, jsonBody)
        .then(function (res) {
          if (res.ok && res.body && res.body.data) {
            ext.storage.sync.set({ strategy: strategy });
            showState('success');
            var d = res.body.data;
            if (d.deal_url) {
              byId('successLink').innerHTML = '<a target="_blank" rel="noopener" href="' + d.deal_url + '">Open deal</a>';
            } else {
              byId('successLink').textContent = JSON.stringify(res.body);
            }
            return null;
          }
          if (res.status === 409 && capturedPayload) {
            return postCapture(
              base,
              token,
              JSON.stringify({ import: capturedPayload, strategy: strategy, merge_listing_media: true }),
            );
          }
          return res;
        })
        .then(function (res) {
          if (!res) {
            return;
          }
          if (res.ok && res.body && res.body.data && res.body.data.status === 'merged_duplicate') {
            showState('success');
            var d = res.body.data;
            byId('successLink').innerHTML = d.deal_url
              ? '<a target="_blank" rel="noopener" href="' + d.deal_url + '">Open deal (gallery merged)</a>'
              : 'Gallery merged into existing deal.';
            return;
          }
          showState('error');
          byId('errorText').textContent = (res.body && (res.body.message || res.body.error)) || 'HTTP ' + res.status;
        })
        .catch(function (e) {
          showState('error');
          byId('errorText').textContent = e && e.message ? e.message : String(e);
        });
    });
  });
})();
