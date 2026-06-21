(function () {
  const API = '/api/scheduled';
  const statusEl = document.getElementById('status');
  const statusGridEl = document.getElementById('status-grid');
  const cronListEl = document.getElementById('cron-list');
  const flowListEl = document.getElementById('flow-list');
  const runListEl = document.getElementById('run-list');

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  async function api(method, path, body) {
    const res = await fetch(API + path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(data.error || ('Request failed: ' + res.status));
    return data;
  }

  function badge(status) {
    const cls = status === 'active' || status === 'succeeded' || status === 'running'
      ? 'active'
      : status === 'failed' || status === 'timed_out'
        ? 'failed'
        : 'paused';
    return '<span class="badge ' + cls + '">' + escapeHtml(status) + '</span>';
  }

  function renderStatus(data) {
    statusGridEl.innerHTML = [
      { label: 'TaskFlows', value: data.flows },
      { label: 'Active cron', value: data.cronJobs },
      { label: 'Queued runs', value: data.runs.queued },
      { label: 'Running', value: data.runs.running },
    ].map(function (card) {
      return '<div class="status-card"><div class="label">' + escapeHtml(card.label) +
        '</div><div class="value">' + escapeHtml(String(card.value)) + '</div></div>';
    }).join('');
    statusEl.textContent = data.taskflowsEnabled ? 'TaskFlows enabled' : 'TaskFlows disabled';
  }

  function renderCron(jobs) {
    if (!jobs.length) {
      cronListEl.innerHTML = '<p class="empty">No cron jobs yet. Run: carina cron add --schedule "0 9 * * *" --prompt "Daily summary"</p>';
      return;
    }
    cronListEl.innerHTML = jobs.map(function (job) {
      const next = job.nextRun ? new Date(job.nextRun).toLocaleString() : 'n/a';
      const action = job.status === 'active'
        ? '<button type="button" data-cron-pause="' + escapeHtml(job.id) + '">Pause</button>'
        : '<button type="button" class="primary" data-cron-resume="' + escapeHtml(job.id) + '">Resume</button>';
      return '<div class="row-item">' +
        badge(job.status) +
        '<span class="title">' + escapeHtml(job.name || job.id.slice(0, 8)) + '</span>' +
        '<span class="meta">' + escapeHtml(job.schedule) + ' | next: ' + escapeHtml(next) + '</span>' +
        action +
        '</div>';
    }).join('');
  }

  function renderFlows(flows) {
    if (!flows.length) {
      flowListEl.innerHTML = '<p class="empty">No TaskFlows registered. Run: carina taskflows create my-flow --prompt "Weekly report"</p>';
      return;
    }
    flowListEl.innerHTML = flows.map(function (flow) {
      const triggers = (flow.triggers || []).join(', ') || 'manual';
      const pauseResume = flow.status === 'active'
        ? '<button type="button" data-flow-pause="' + escapeHtml(flow.id) + '">Pause</button>'
        : '<button type="button" data-flow-resume="' + escapeHtml(flow.id) + '">Resume</button>';
      return '<div class="row-item">' +
        badge(flow.status) +
        '<span class="title">' + escapeHtml(flow.label || flow.name) + '</span>' +
        '<span class="meta">' + flow.stepCount + ' steps | ' + escapeHtml(triggers) + '</span>' +
        '<button type="button" class="primary" data-flow-run="' + escapeHtml(flow.id) + '">Run now</button>' +
        pauseResume +
        '</div>';
    }).join('');
  }

  function renderRuns(runs) {
    if (!runs.length) {
      runListEl.innerHTML = '<p class="empty">No recent TaskFlow runs.</p>';
      return;
    }
    runListEl.innerHTML = runs.map(function (run) {
      const when = run.startedAt ? new Date(run.startedAt).toLocaleString() : 'queued';
      const preview = run.outputPreview || run.error || '';
      const cancel = (run.status === 'queued' || run.status === 'running')
        ? '<button type="button" data-run-cancel="' + escapeHtml(run.id) + '">Cancel</button>'
        : '';
      return '<div class="row-item">' +
        badge(run.status) +
        '<span class="title">' + escapeHtml(run.flowName) + '</span>' +
        '<span class="meta">' + escapeHtml(when) + (preview ? ' | ' + escapeHtml(preview.slice(0, 80)) : '') + '</span>' +
        cancel +
        '</div>';
    }).join('');
  }

  async function refresh() {
    const status = await api('GET', '/status');
    renderStatus(status);
    const cron = await api('GET', '/cron');
    renderCron(cron.jobs || []);
    const flows = await api('GET', '/flows');
    renderFlows(flows.flows || []);
    const runs = await api('GET', '/runs?limit=20');
    renderRuns(runs.runs || []);
  }

  document.body.addEventListener('click', function (event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const runId = target.getAttribute('data-flow-run');
    const pauseFlow = target.getAttribute('data-flow-pause');
    const resumeFlow = target.getAttribute('data-flow-resume');
    const pauseCron = target.getAttribute('data-cron-pause');
    const resumeCron = target.getAttribute('data-cron-resume');
    const cancelRun = target.getAttribute('data-run-cancel');

    let promise = null;
    if (runId) promise = api('POST', '/flows/' + encodeURIComponent(runId) + '/trigger');
    if (pauseFlow) promise = api('POST', '/flows/' + encodeURIComponent(pauseFlow) + '/pause');
    if (resumeFlow) promise = api('POST', '/flows/' + encodeURIComponent(resumeFlow) + '/resume');
    if (pauseCron) promise = api('POST', '/cron/' + encodeURIComponent(pauseCron) + '/pause');
    if (resumeCron) promise = api('POST', '/cron/' + encodeURIComponent(resumeCron) + '/resume');
    if (cancelRun) promise = api('POST', '/runs/' + encodeURIComponent(cancelRun) + '/cancel');

    if (promise) {
      statusEl.textContent = 'Updating...';
      promise.then(function () { return refresh(); })
        .then(function () { statusEl.textContent = 'Updated'; })
        .catch(function (err) {
          statusEl.textContent = 'Error';
          alert(err.message);
        });
    }
  });

  refresh().catch(function (err) {
    statusEl.textContent = 'Error';
    cronListEl.innerHTML = '<p class="empty">' + escapeHtml(err.message) + '</p>';
  });
})();
