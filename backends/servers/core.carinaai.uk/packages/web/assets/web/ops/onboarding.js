(function () {
  const STEP_CTA = {
    billing: { label: 'Open billing', href: '/ops/billing' },
    byok: { label: 'Connect your first API key', href: '/ops/vault' },
    workbench: { label: 'Run a test prompt', href: '/ops/workbench' },
    usage: { label: 'Review usage', href: '/ops/usage' },
    invite: { label: 'Invite a teammate', href: '/ops/settings' },
  };

  let pollTimer;

  function renderChecklist(data) {
    const fill = document.getElementById('progress-fill');
    const label = document.getElementById('progress-label');
    const list = document.getElementById('step-list');
    const complete = document.getElementById('onboarding-complete');
    const dismissBtn = document.getElementById('dismiss-btn');
    if (!fill || !label || !list) return;

    const pct = Number(data.percentComplete ?? 0);
    fill.style.width = `${pct}%`;
    label.textContent = `${data.completedCount ?? 0} of ${data.totalCount ?? 0} steps complete (${pct}%)`;

    const steps = data.steps || [];
    list.innerHTML = steps.map((step) => {
      const mark = step.done ? 'Done' : 'Pending';
      const cta = !step.done && STEP_CTA[step.id]
        ? `<a class="btn secondary" href="${STEP_CTA[step.id].href}" style="margin-left:8px;">${CarinaOpsLayout.escapeHtml(STEP_CTA[step.id].label)}</a>`
        : '';
      return `<li class="onboarding-step${step.done ? ' done' : ''}"><span class="step-mark">${mark}</span><span>${CarinaOpsLayout.escapeHtml(step.label)}</span>${cta}</li>`;
    }).join('');

    const done = pct >= 100;
    if (complete) complete.hidden = !done;
    if (dismissBtn) dismissBtn.hidden = done;
  }

  async function loadChecklist() {
    const res = await fetch('/api/carina-ops/onboarding');
    if (!res.ok) return;
    const data = await res.json();
    renderChecklist(data);
    if (Number(data.percentComplete) >= 100 && pollTimer) {
      clearInterval(pollTimer);
    }
  }

  async function dismissWizard() {
    localStorage.setItem('carina-ops-onboarding-dismissed', '1');
    await fetch('/api/carina-ops/onboarding/dismiss', { method: 'POST' }).catch(() => null);
    location.href = '/ops/';
  }

  CarinaOpsLayout.initPage('onboarding', {
    onReady: async () => {
      await loadChecklist();
      pollTimer = setInterval(loadChecklist, 10_000);
      const dismissBtn = document.getElementById('dismiss-btn');
      if (dismissBtn) {
        dismissBtn.addEventListener('click', dismissWizard);
      }
    },
  });
})();
