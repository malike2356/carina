(function () {
  async function load(filters) {
    const params = new URLSearchParams();
    if (filters && filters.outcome) params.set('outcome', filters.outcome);
    if (filters && filters.event_type) params.set('event_type', filters.event_type);
    params.set('limit', '50');

    const res = await fetch('/api/actions/executions?' + params.toString(), {
      headers: window.H ? H() : {},
    });
    if (!res.ok) return;
    const data = await res.json();
    render(data.executions || []);
  }

  function outcomeLabel(outcome) {
    const map = { success: 'OK', failure: 'FAILED', partial: 'PARTIAL', dry_run: 'DRY RUN' };
    return map[outcome] || outcome;
  }

  function outcomeColor(outcome) {
    const map = { success: 'var(--green)', failure: 'var(--red)', partial: 'var(--amber)', dry_run: 'var(--cyan)' };
    return map[outcome] || 'var(--text)';
  }

  function executorLabel(executedBy, executionType) {
    if (executionType === 'auto') return 'system';
    return executedBy || 'operator';
  }

  function timeLabel(isoString) {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function eventLabel(meta) {
    if (!meta) return '';
    const type = meta.eventType || '';
    const sev = meta.eventSeverity || '';
    if (!type) return '';
    const human = {
      anomaly_detected: 'Unusual activity',
      breach_detected: 'Security breach',
      alert_test: 'Test alert',
      alert_escalated: 'Unacknowledged alert',
      killswitch_armed: 'Kill switch armed',
    };
    const label = human[type] || type.replace(/_/g, ' ');
    return sev ? label + ' (' + sev + ')' : label;
  }

  function escHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function render(items) {
    const el = document.getElementById('action-audit-list');
    if (!el) return;

    if (items.length === 0) {
      el.innerHTML = '<div class="spec-empty">No actions recorded yet</div>';
      return;
    }

    el.innerHTML = items.map(function (item) {
      const meta = item.metadata || {};
      const color = outcomeColor(item.outcome);
      return (
        '<div class="audit-row action-audit-row">' +
          '<span class="audit-time">' + escHtml(timeLabel(item.executedAt)) + '</span>' +
          '<span class="audit-by">' + escHtml(executorLabel(item.executedBy, item.executionType)) + '</span>' +
          '<span class="audit-action">' + escHtml(item.actionLabel) + '</span>' +
          '<span class="audit-outcome" style="color:' + color + '">' + escHtml(outcomeLabel(item.outcome)) + '</span>' +
          '<span class="audit-event">' + escHtml(eventLabel(meta)) + '</span>' +
        '</div>'
      );
    }).join('');
  }

  window.DashboardActionAudit = { load };

  window.addEventListener('load', function () {
    void load(null);

    const outcomeFilter = document.getElementById('action-audit-outcome-filter');
    if (outcomeFilter) {
      outcomeFilter.addEventListener('change', function () {
        void load({ outcome: outcomeFilter.value || null });
      });
    }

    setInterval(function () { void load(null); }, 30000);
  });
})();
