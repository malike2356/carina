(function () {
  const NAV = [
    { id: 'overview', label: 'Overview', href: '/ops/' },
    { id: 'workbench', label: 'Workbench', href: '/ops/workbench' },
    { id: 'files', label: 'Files', href: '/ops/files' },
    { id: 'skills', label: 'Skills', href: '/ops/skills' },
    { id: 'batches', label: 'Batches', href: '/ops/batches' },
    { id: 'agents', label: 'Agents', href: '/ops/agents' },
    { id: 'sessions', label: 'Sessions', href: '/ops/sessions' },
    { id: 'vault', label: 'Vault', href: '/ops/vault' },
    { id: 'memory', label: 'Memory', href: '/ops/memory' },
    { id: 'analytics', label: 'Analytics', href: '/ops/analytics' },
    { id: 'credits', label: 'Credits', href: '/ops/credits' },
    { id: 'usage', label: 'Usage', href: '/ops/usage' },
    { id: 'audit', label: 'Audit', href: '/ops/audit' },
    { id: 'settings', label: 'Settings', href: '/ops/settings' },
    { id: 'billing', label: 'Billing', href: '/ops/billing' },
  ];

  const TEAM_NAV = [
    { id: 'deployments', label: 'Deployments', href: '/ops/deployments' },
    { id: 'environments', label: 'Environments', href: '/ops/environments' },
  ];

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  async function requireOpsSession() {
    const res = await fetch('/app/auth/me');
    if (!res.ok) {
      location.href = '/hosted-login';
      return null;
    }
    return res.json();
  }

  function showPlanBadge(plan, elId) {
    const el = document.getElementById(elId || 'plan-badge');
    if (!el) return;
    const label = String(plan || 'free').replace(/_/g, ' ');
    el.textContent = label;
    el.hidden = !plan;
  }

  function renderNav(activePage, containerId, plan) {
    const nav = document.getElementById(containerId || 'ops-nav');
    if (!nav) return;
    const items = NAV.slice();
    if (plan === 'carina_ops_team') {
      const vaultIdx = items.findIndex((item) => item.id === 'vault');
      const insertAt = vaultIdx >= 0 ? vaultIdx : 8;
      items.splice(insertAt, 0, ...TEAM_NAV);
    }
    nav.innerHTML = items.map((item) => {
      const active = item.id === activePage ? ' class="active"' : '';
      return `<a href="${item.href}"${active}>${item.label}</a>`;
    }).join('');
    nav.innerHTML += '<a href="/">Chat</a>';
  }

  async function maybeRedirectToOnboarding(activePage) {
    if (activePage !== 'overview') return false;
    if (localStorage.getItem('carina-ops-onboarding-dismissed') === '1') return false;
    const res = await fetch('/api/carina-ops/onboarding').catch(() => null);
    if (!res || !res.ok) return false;
    const data = await res.json();
    if (data.dismissed || Number(data.percentComplete) >= 100) return false;
    location.href = '/ops/onboarding';
    return true;
  }

  async function initPage(activePage, options) {
    const opts = options || {};
    const me = await requireOpsSession();
    if (!me) return null;
    if (await maybeRedirectToOnboarding(activePage)) return null;
    renderNav(activePage, undefined, me.org?.plan || 'free');
    const orgName = me.org?.name || me.email || 'Organization';
    const orgEl = document.getElementById('org-name');
    if (orgEl) orgEl.textContent = orgName;
    showPlanBadge(me.org?.plan || 'free');
    await renderTrialBanner();
    await renderCreditsBanner();
    if (typeof opts.onReady === 'function') {
      await opts.onReady(me);
    }
    return me;
  }

  async function renderTrialBanner() {
    const slot = document.getElementById('global-trial-banner');
    if (!slot) return;
    const res = await fetch('/api/carina-ops/billing/summary').catch(() => null);
    if (!res || !res.ok) return;
    const data = await res.json();
    if (data.trialDaysLeft != null && data.trialDaysLeft > 0) {
      slot.className = 'banner-trial';
      slot.textContent = `Team trial: ${data.trialDaysLeft} day(s) left. Add billing to keep access.`;
      slot.hidden = false;
    }
  }

  function ensureCreditsBannerSlot() {
    let slot = document.getElementById('global-credits-banner');
    if (slot) return slot;
    slot = document.createElement('div');
    slot.id = 'global-credits-banner';
    slot.className = 'banner-warn';
    slot.hidden = true;
    const nav = document.getElementById('ops-nav');
    if (nav && nav.parentNode) {
      nav.parentNode.insertBefore(slot, nav.nextSibling);
    }
    return slot;
  }

  function formatCredits(value) {
    if (value == null) return '-';
    return Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 });
  }

  async function renderCreditsBanner() {
    const slot = ensureCreditsBannerSlot();
    const res = await fetch('/api/carina-ops/credits').catch(() => null);
    if (!res || !res.ok) {
      slot.hidden = true;
      return null;
    }
    const credits = await res.json();
    const unit = credits.unit === 'tokens' ? 'tokens' : 'credits';
    const pct = Number(credits.percentUsed ?? 0);
    if (!credits.warning && pct < 75) {
      slot.hidden = true;
      return credits;
    }
    slot.hidden = false;
    if (pct >= 95 || credits.remaining <= 0) {
      slot.className = 'banner-warn banner-critical';
    } else if (pct >= 90) {
      slot.className = 'banner-warn banner-high';
    } else {
      slot.className = 'banner-warn';
    }
    slot.textContent = `Usage warning: ${formatCredits(credits.usedThisMonth)} / ${formatCredits(credits.monthlyLimit)} ${unit} this month (${pct}%).`;
    return credits;
  }

  window.CarinaOpsLayout = {
    requireOpsSession,
    renderNav,
    showPlanBadge,
    renderTrialBanner,
    renderCreditsBanner,
    formatCredits,
    initPage,
    escapeHtml,
  };
})();
