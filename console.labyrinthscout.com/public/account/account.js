function showToast(message, type) {
  let toast = document.getElementById('account-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'account-toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.className = 'toast show ' + (type === 'ok' ? 'ok' : 'err');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(function () {
    toast.classList.remove('show');
  }, 4200);
}

async function apiFetch(url, options) {
  const res = await fetch(url, {
    credentials: 'same-origin',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options && options.headers ? options.headers : {}),
    },
  });

  const contentType = res.headers.get('content-type') || '';
  let data = {};
  if (contentType.includes('application/json')) {
    data = await res.json().catch(function () { return {}; });
  } else if (!res.ok) {
    const text = await res.text().catch(function () { return ''; });
    if (text.includes('Authorization Required')) {
      data = { error: 'Server blocked the request. Refresh the page and try again.' };
    } else if (res.redirected || text.includes('<html')) {
      data = { error: 'Session expired. Sign in again.' };
    } else {
      data = { error: text || 'Request failed' };
    }
  }

  return { res, data };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
  });
}

function timeAgo(iso) {
  if (!iso) return 'never';
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return seconds + 's ago';
  if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
  if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
  return Math.floor(seconds / 86400) + 'd ago';
}
