(function () {
  const API = '/api/notes';
  let viewDate = new Date();
  let reminders = [];

  const monthLabelEl = document.getElementById('month-label');
  const gridEl = document.getElementById('calendar-grid');
  const upcomingEl = document.getElementById('upcoming-list');
  const statusEl = document.getElementById('status');

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

  function sameDay(a, b) {
    return a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();
  }

  function formatMonth(date) {
    return date.toLocaleString(undefined, { month: 'long', year: 'numeric' });
  }

  async function loadReminders() {
    statusEl.textContent = 'Loading...';
    const res = await fetch(API);
    const data = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(data.error || 'Failed to load reminders');
    reminders = (data.notes || []).filter(function (note) {
      return note.format === 'reminder' && note.remindAt && !note.done;
    });
    statusEl.textContent = reminders.length + ' reminder' + (reminders.length === 1 ? '' : 's');
  }

  function remindersForDay(day) {
    return reminders.filter(function (note) {
      return sameDay(new Date(note.remindAt), day);
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
    const today = new Date();

    for (let i = 0; i < 42; i += 1) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      const cell = document.createElement('div');
      const otherMonth = day.getMonth() !== viewDate.getMonth();
      cell.className = 'day' + (otherMonth ? ' other' : '');
      const dayEvents = remindersForDay(day);
      const eventsHtml = dayEvents.map(function (note) {
        const overdue = new Date(note.remindAt) < new Date();
        return '<a class="event' + (overdue ? ' overdue' : '') + '" href="/notes">' +
          escapeHtml(note.title || 'Reminder') + '</a>';
      }).join('');
      cell.innerHTML = '<div class="day-num">' + day.getDate() + '</div>' + eventsHtml;
      gridEl.appendChild(cell);
    }
  }

  function renderUpcoming() {
    const sorted = reminders.slice().sort(function (a, b) {
      return new Date(a.remindAt).getTime() - new Date(b.remindAt).getTime();
    }).slice(0, 12);

    if (!sorted.length) {
      upcomingEl.innerHTML = '<p class="empty">No upcoming reminders. Add one in Notes.</p>';
      return;
    }

    upcomingEl.innerHTML = sorted.map(function (note) {
      const when = new Date(note.remindAt).toLocaleString();
      const overdue = new Date(note.remindAt) < new Date();
      return '<div class="upcoming-item">' +
        '<a href="/notes">' + escapeHtml(note.title || 'Reminder') + '</a>' +
        '<div class="meta">' + escapeHtml(when) + (overdue ? ' | overdue' : '') + '</div>' +
        '</div>';
    }).join('');
  }

  document.getElementById('prev-month').addEventListener('click', function () {
    viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1);
    renderCalendar();
  });
  document.getElementById('next-month').addEventListener('click', function () {
    viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1);
    renderCalendar();
  });
  document.getElementById('today-btn').addEventListener('click', function () {
    viewDate = new Date();
    renderCalendar();
  });

  loadReminders()
    .then(function () {
      renderCalendar();
      renderUpcoming();
    })
    .catch(function (err) {
      statusEl.textContent = '';
      upcomingEl.innerHTML = '<p class="empty">' + escapeHtml(err.message) + '</p>';
    });
})();
