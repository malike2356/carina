import crypto from 'node:crypto';
import type { Router } from 'express';
import { getWorker } from '../workers/worker-store.js';
import { validateAndSetPropreneurBinding } from '../workers/worker-bridge-store.js';

type ConnectPayload = {
  workspaceId: string;
  workerId: string;
  tenantSlug?: string;
  ts: number;
};

function signingSecret(): string {
  return (
    process.env.PROPREENEUR_AUTO_BRIDGE_SECRET?.trim()
    || process.env.CARINA_INTERNAL_KEY?.trim()
    || ''
  );
}

function sign(payload: Omit<ConnectPayload, 'ts'>): string {
  const secret = signingSecret();
  if (!secret) return '';
  const body = Buffer.from(JSON.stringify({ ...payload, ts: Date.now() }), 'utf8').toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${signature}`;
}

function verify(token: string, maxAgeMs = 15 * 60 * 1000): ConnectPayload | null {
  const secret = signingSecret();
  const [body, signature] = token.split('.');
  if (!secret || !body || !signature) return null;
  const expected = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  try {
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as ConnectPayload;
    if (!payload.workspaceId || !payload.workerId || !payload.ts) return null;
    if (Date.now() - payload.ts > maxAgeMs) return null;
    return payload;
  } catch {
    return null;
  }
}

function cleanSlug(value: unknown): string {
  return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
}

function tenantBaseDomain(): string {
  return (process.env.PROPREENEUR_TENANT_BASE_DOMAIN ?? 'propreneur.uk').trim();
}

function appUrl(path: string): string {
  const base = (
    process.env.AIVA_APP_URL
    ?? process.env.CARINA_HOSTED_APP_URL
    ?? 'https://app.carinaai.uk'
  ).replace(/\/$/, '');
  return `${base}${path}`;
}

export function createPropreneurConnectToken(workspaceId: string, workerId: string): string {
  return sign({ workspaceId, workerId });
}

export function registerPropreneurOAuthRoutes(router: Router): void {
  router.get('/propreneur/panel.js', (_req, res) => {
    res.set('Cache-Control', 'no-store').type('application/javascript').send(`
(() => {
  let workerId = '';
  let status = null;
  let loading = false;

  const message = (root, text, ok = false) => {
    const node = root.querySelector('[data-propreneur-message]');
    node.textContent = text || '';
    node.style.color = ok ? '#4ade80' : '#f87171';
  };

  const loadStatus = async (root) => {
    if (loading) return;
    loading = true;
    try {
      const response = await fetch('/api/aiva/workers/' + workerId + '/propreneur/status');
      if (!response.ok) throw new Error('Could not load connection status');
      status = await response.json();
      const badge = root.querySelector('[data-propreneur-status]');
      badge.textContent = status.bound ? 'Connected to ' + status.tenantSlug : 'Not connected';
      badge.style.color = status.bound ? '#4ade80' : '';
    } catch (error) {
      message(root, error instanceof Error ? error.message : 'Could not load connection status');
    } finally {
      loading = false;
    }
  };

  const mount = () => {
    const match = location.pathname.match(/^\\/aiva\\/workers\\/([0-9a-f-]+)$/i);
    if (!match) return;
    const nextWorkerId = match[1];
    const existing = document.querySelector('[data-propreneur-panel]');
    if (existing?.dataset.workerId === nextWorkerId) return;
    existing?.remove();
    workerId = nextWorkerId;
    status = null;
    const headings = [...document.querySelectorAll('h2,h3')];
    const anchor = headings.find((node) => /^(Edit|Security and privacy)$/i.test(node.textContent.trim()));
    if (!anchor) return;
    const section = anchor.closest('div');
    if (!section || !section.parentElement) return;

    const root = document.createElement('section');
    root.dataset.propreneurPanel = 'true';
    root.dataset.workerId = workerId;
    root.style.cssText = 'margin-bottom:2rem;border:1px solid var(--border);border-radius:.75rem;padding:1rem;background:var(--surface-elevated,var(--surface));';
    root.innerHTML = '<h3 style="font-size:.875rem;font-weight:600;margin:0 0 .5rem">Propreneur integration</h3>'
      + '<p style="font-size:.75rem;opacity:.75;margin:0 0 .75rem">Connect this Aiva to your Propreneur workspace. Enter the name before .propreneur.uk, then approve on Propreneur.</p>'
      + '<p data-propreneur-status style="font-size:.75rem;margin:0 0 .75rem">Loading connection status...</p>'
      + '<form data-propreneur-connect style="display:flex;gap:.5rem;flex-wrap:wrap">'
      + '<input name="tenantSlug" required placeholder="Workspace name, e.g. xelox" style="min-width:16rem;flex:1;padding:.55rem .7rem;border:1px solid var(--border);border-radius:.5rem;background:var(--surface);color:inherit">'
      + '<button type="submit" class="btn-primary">Connect Propreneur</button></form>'
      + '<details style="margin-top:.75rem"><summary style="font-size:.75rem;cursor:pointer">Paste API key instead</summary>'
      + '<form data-propreneur-manual style="display:grid;gap:.5rem;margin-top:.5rem"><input name="apiKey" type="password" required placeholder="crm_..." style="padding:.55rem .7rem;border:1px solid var(--border);border-radius:.5rem;background:var(--surface);color:inherit">'
      + '<button type="submit" class="btn-primary" style="width:max-content">Bind with key</button></form></details>'
      + '<p data-propreneur-message style="font-size:.75rem;margin:.5rem 0 0"></p>';
    section.parentElement.insertBefore(root, section);

    root.querySelector('[data-propreneur-connect]').addEventListener('submit', (event) => {
      event.preventDefault();
      const slug = new FormData(event.currentTarget).get('tenantSlug').toString().trim().toLowerCase();
      if (!status?.connectToken) {
        message(root, 'Connection token is unavailable. Refresh and try again.');
        return;
      }
      location.href = 'https://core.carinaai.uk/api/aiva/propreneur/oauth/start?tenantSlug='
        + encodeURIComponent(slug) + '&token=' + encodeURIComponent(status.connectToken);
    });

    root.querySelector('[data-propreneur-manual]').addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const slug = root.querySelector('[name=tenantSlug]').value.trim();
      const apiKey = data.get('apiKey').toString().trim();
      const response = await fetch('/api/aiva/workers/' + workerId + '/propreneur/bind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantSlug: slug, apiKey }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        message(root, body.error || 'Binding failed');
        return;
      }
      message(root, 'Connected. Portfolio properties visible: ' + (body.propertyCount ?? 0), true);
      await loadStatus(root);
    });
    void loadStatus(root);
  };

  const observer = new MutationObserver(mount);
  observer.observe(document.body, { childList: true, subtree: true });
  mount();
})();
`);
  });

  router.get('/propreneur/oauth/start', async (req, res) => {
    const connect = verify(String(req.query.token ?? ''));
    const tenantSlug = cleanSlug(req.query.tenantSlug);
    if (!connect || !tenantSlug) {
      res.status(400).json({ error: 'Invalid or expired connection link' });
      return;
    }

    const worker = await getWorker(connect.workspaceId, connect.workerId);
    if (!worker) {
      res.status(404).json({ error: 'Worker not found' });
      return;
    }

    const state = sign({
      workspaceId: connect.workspaceId,
      workerId: connect.workerId,
      tenantSlug,
    });
    const callback = `https://core.carinaai.uk/api/aiva/workers/${encodeURIComponent(connect.workerId)}/propreneur/oauth/callback`;
    const authorize = new URL(`https://${tenantSlug}.${tenantBaseDomain()}/aiva/authorize`);
    authorize.searchParams.set('state', state);
    authorize.searchParams.set('callback', callback);
    res.redirect(authorize.toString());
  });

  router.get('/workers/:id/propreneur/oauth/callback', async (req, res) => {
    const workerId = String(req.params.id ?? '');
    const state = String(req.query.state ?? '');
    const code = String(req.query.code ?? '');
    const error = String(req.query.error ?? '');

    const redirectToSettings = (params: Record<string, string>) => {
      const target = new URL(`/aiva/workers/${encodeURIComponent(workerId)}`, appUrl(''));
      target.searchParams.set('tab', 'settings');
      for (const [key, value] of Object.entries(params)) target.searchParams.set(key, value);
      res.redirect(target.toString());
    };

    if (error) {
      redirectToSettings({ propreneur_error: error === 'access_denied' ? 'denied' : error });
      return;
    }

    const payload = verify(state);
    if (!payload || payload.workerId !== workerId || !payload.tenantSlug || !code) {
      redirectToSettings({ propreneur_error: 'invalid_state' });
      return;
    }

    try {
      const exchange = await fetch(
        `https://${payload.tenantSlug}.${tenantBaseDomain()}/api/aiva-oauth/exchange`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ code, state }),
        },
      );
      if (!exchange.ok) {
        redirectToSettings({ propreneur_error: 'exchange_failed' });
        return;
      }
      const grant = await exchange.json() as { tenant_slug?: string; api_key?: string };
      const tenantSlug = cleanSlug(grant.tenant_slug ?? payload.tenantSlug);
      const apiKey = String(grant.api_key ?? '').trim();
      if (!tenantSlug || !apiKey) {
        redirectToSettings({ propreneur_error: 'incomplete_grant' });
        return;
      }

      const result = await validateAndSetPropreneurBinding(
        payload.workspaceId,
        workerId,
        tenantSlug,
        apiKey,
      );
      redirectToSettings({
        propreneur_ok: '1',
        propreneur_slug: result.tenantSlug,
        propreneur_props: String(result.propertyCount),
      });
    } catch (err) {
      console.warn('[propreneur-oauth] callback failed:', err);
      redirectToSettings({ propreneur_error: 'server_error' });
    }
  });
}
