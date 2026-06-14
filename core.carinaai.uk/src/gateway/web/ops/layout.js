(function () {
  const NAV = [
    { id: 'overview', label: 'Overview', href: '/ops/' },
    { id: 'workbench', label: 'Workbench', href: '/ops/workbench' },
    { id: 'vault', label: 'Vault', href: '/ops/vault' },
    { id: 'usage', label: 'Usage', href: '/ops/usage' },
    { id: 'audit', label: 'Audit', href: '/ops/audit' },
    { id: 'settings', label: 'Settings', href: '/ops/settings' },
    { id: 'billing', label: 'Billing', href: '/ops/billing' },
  ];

  const TEAM_NAV = [
    { id: 'deployments', label: 'Deployments', href: '/ops/#deployments' },
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
      items.splice(5, 0, TEAM_NAV[0]);
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

  window.CarinaOpsLayout = {
    requireOpsSession,
    renderNav,
    showPlanBadge,
    renderTrialBanner,
    initPage,
    escapeHtml,
  };
})();
