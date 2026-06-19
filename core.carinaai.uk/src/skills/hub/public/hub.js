(function () {
  const isLocal =
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const apiBase = isLocal ? '' : 'https://hub.carinaai.uk';

  function esc(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  async function api(path, options) {
    const url = path.startsWith('http') ? path : `${apiBase}${path}`;
    const res = await fetch(url, options);
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { error: text || res.statusText };
    }
    if (!res.ok) {
      const message = data?.error || `Request failed (${res.status})`;
      throw new Error(message);
    }
    return data;
  }

  function renderStars(rating, max) {
    const limit = max ?? 5;
    const value = Math.max(0, Math.min(Number(rating) || 0, limit));
    let html =
      '<span class="stars" aria-label="' + esc(value.toFixed(1)) + ' out of ' + limit + '">';
    for (let i = 1; i <= limit; i += 1) {
      let fill = 0;
      if (value >= i) fill = 100;
      else if (value > i - 1) fill = Math.round((value - (i - 1)) * 100);
      html +=
        '<span class="star">' +
        '<span class="star-base" aria-hidden="true">&#9733;</span>' +
        '<span class="star-overlay" style="width:' + fill + '%" aria-hidden="true">&#9733;</span>' +
        '</span>';
    }
    html += '</span>';
    return html;
  }

  async function copyToClipboard(text) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'absolute';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }

  function badgePill(label, type) {
    const kind = type || 'community';
    return '<span class="badge badge-' + esc(kind) + '">' + esc(label) + '</span>';
  }

  function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
  }

  function debounce(fn, ms) {
    let timer = null;
    return function debounced(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  function installCommand(packName) {
    return 'carina hub install pack:' + packName;
  }

  function excerpt(text, len) {
    const s = String(text || '');
    if (s.length <= len) return s;
    return s.slice(0, len).trim() + '...';
  }

  function truncateId(id, len) {
    const s = String(id || '');
    if (s.length <= len) return s;
    return s.slice(0, len) + '...';
  }

  function renderNav(active) {
    return (
      '<nav class="site-nav">' +
      '<div class="wrap nav-inner">' +
      '<a class="nav-logo" href="/">Carina Hub</a>' +
      '<div class="nav-links">' +
      '<a href="/browse.html"' +
      (active === 'browse' ? ' class="active"' : '') +
      '>Browse</a>' +
      '<a href="/publish.html"' +
      (active === 'publish' ? ' class="active"' : '') +
      '>Publish</a>' +
      '</div></div></nav>'
    );
  }

  function renderFooter() {
    return (
      '<footer class="site-foot">' +
      '<div class="wrap">' +
      '<p>MIT licensed agent kernel by <a href="https://carinaai.uk">VERLOX Ltd</a>. ' +
      'Docs at <a href="https://docs.carinaai.uk">docs.carinaai.uk</a>.</p>' +
      '</div></footer>'
    );
  }

  function bindCopyButtons(root) {
    (root || document).querySelectorAll('[data-copy]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const text = btn.getAttribute('data-copy') || '';
        try {
          await copyToClipboard(text);
          const original = btn.textContent;
          btn.textContent = 'Copied!';
          setTimeout(() => {
            btn.textContent = original;
          }, 2000);
        } catch (err) {
          btn.textContent = 'Copy failed';
          setTimeout(() => {
            btn.textContent = 'Copy';
          }, 2000);
        }
      });
    });
  }

  window.CarinaHub = {
    apiBase,
    api,
    renderStars,
    copyToClipboard,
    badgePill,
    formatDate,
    debounce,
    esc,
    excerpt,
    truncateId,
    installCommand,
    renderNav,
    renderFooter,
    bindCopyButtons,
  };
})();
