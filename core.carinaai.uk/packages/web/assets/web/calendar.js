(function () {
  const API = '/api/calendar';
  let viewDate = new Date();
  let events = [];

  const monthLabelEl = document.getElementById('month-label');
  const gridEl = document.getElementById('calendar-grid');
  const upcomingEl = document.getElementById('upcoming-list');
  const statusEl = document.getElementById('status');
  const syncStatusEl = document.getElementById('sync-status');

  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function startOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  function endOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
  }

  function sameDay(a, b) {
    return a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();
  }

  function formatMonth(date) {
    return date.toLocaleString(undefined, { month: 'long', year: 'numeric' });
  }

  function rangeForView() {
    const first = startOfMonth(viewDate);
    const start = new Date(first);
    start.setDate(first.getDate() - first.getDay());
    const end = new Date(start);
    end.setDate(start.getDate() + 41);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  async function loadSyncStatus() {
    if (!syncStatusEl) return;
    const res = await fetch(API + '/sync/status');
    const data = await res.json().catch(function () { return {}; });
    if (!res.ok) {
      syncStatusEl.textContent = data.error || 'Sync status unavailable';
      return;
    }
    syncStatusEl.textContent = data.message || '';
    syncStatusEl.dataset.configured = data.configured ? '1' : '0';
    syncStatusEl.dataset.implementation = data.implementation || 'none';
    if (data.lastSyncAt) {
      syncStatusEl.textContent += ' Last sync: ' + new Date(data.lastSyncAt).toLocaleString() + '.';
    }
    if (data.lastSyncError) {
      syncStatusEl.textContent += ' Error: ' + data.lastSyncError;
    }
  }

  async function loadEvents() {
    statusEl.textContent = 'Loading...';
    const range = rangeForView();
    const qs = '?start=' + encodeURIComponent(range.start.toISOString()) +
      '&end=' + encodeURIComponent(range.end.toISOString());
    const res = await fetch(API + '/events' + qs);
    const data = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(data.error || 'Failed to load events');
    events = data.events || [];
    const notesCount = (data.sources && data.sources.notes) || 0;
    const caldavCount = (data.sources && data.sources.caldav) || 0;
    statusEl.textContent = events.length + ' event' + (events.length === 1 ? '' : 's') +
      ' (' + notesCount + ' reminders' + (caldavCount ? ', ' + caldavCount + ' synced' : '') + ')';
  }

  function eventsForDay(day) {
    return events.filter(function (event) {
      return sameDay(new Date(event.start), day);
    });
  }

  function renderCalendar() {
    monthLabelEl.textContent = formatMonth(viewDate);
    gridEl.innerHTML = '';
    DOW.forEach(function (label) {
      const el = document.createElement('div');
      el.className = 'dow';
      el.textContent = label;
      gridEl.appendChild(el);
    });

    const first = startOfMonth(viewDate);
    const start = new Date(first);
    start.setDate(first.getDate() - first.getDay());

    for (let i = 0; i < 42; i += 1) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      const cell = document.createElement('div');
      const otherMonth = day.getMonth() !== viewDate.getMonth();
      cell.className = 'day' + (otherMonth ? ' other' : '');
      const dayEvents = eventsForDay(day);
      const eventsHtml = dayEvents.map(function (event) {
        const overdue = event.overdue || new Date(event.start) < new Date();
        const href = event.href || '#';
        const sourceTag = event.source === 'caldav' ? ' [sync]' : '';
        return '<a class="event' + (overdue ? ' overdue' : '') + '" href="' + escapeHtml(href) + '">' +
          escapeHtml(event.title + sourceTag) + '</a>';
      }).join('');
      cell.innerHTML = '<div class="day-num">' + day.getDate() + '</div>' + eventsHtml;
      gridEl.appendChild(cell);
    }
  }

  function renderUpcoming() {
    const sorted = events.slice().sort(function (a, b) {
      return new Date(a.start).getTime() - new Date(b.start).getTime();
    }).slice(0, 12);

    if (!sorted.length) {
      upcomingEl.innerHTML = '<p class="empty">No upcoming events. Add a reminder in Notes or configure CalDAV sync.</p>';
      return;
    }

    upcomingEl.innerHTML = sorted.map(function (event) {
      const when = new Date(event.start).toLocaleString();
      const overdue = event.overdue || new Date(event.start) < new Date();
      const href = event.href || '#';
      return '<div class="upcoming-item">' +
        '<a href="' + escapeHtml(href) + '">' + escapeHtml(event.title) + '</a>' +
        '<div class="meta">' + escapeHtml(when) +
        (overdue ? ' | overdue' : '') +
        ' | ' + escapeHtml(event.source) +
        '</div></div>';
    }).join('');
  }

  async function refresh() {
    await loadEvents();
    renderCalendar();
    renderUpcoming();
  }

  document.getElementById('prev-month').addEventListener('click', function () {
    viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1);
    refresh().catch(function (err) {
      statusEl.textContent = err.message;
    });
  });
  document.getElementById('next-month').addEventListener('click', function () {
    viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1);
    refresh().catch(function (err) {
      statusEl.textContent = err.message;
    });
  });
  document.getElementById('today-btn').addEventListener('click', function () {
    viewDate = new Date();
    refresh().catch(function (err) {
      statusEl.textContent = err.message;
    });
  });

  Promise.all([loadSyncStatus(), refresh()]).catch(function (err) {
    statusEl.textContent = '';
    upcomingEl.innerHTML = '<p class="empty">' + escapeHtml(err.message) + '</p>';
  });
})();
