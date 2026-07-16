import { Readable } from 'stream';
import { Router } from 'express';
import {
  SCOUT_BASE,
  SCOUT_CONSOLE_BASE,
  scoutGet,
  scoutHeaders,
  scoutConsoleGetDetailed,
  scoutConsolePost,
  resolveScoutProxyBase,
} from '../lib/scout.js';

export const scoutDashboardRouter = Router();

interface ScoutStats {
  critical: number;
  warning: number;
  info: number;
  breach: number;
}

interface ScoutInstance {
  id: string;
  name: string;
  status: string;
  last_heartbeat: string | null;
  secondsAgo?: number | null;
}

interface StatusPayload {
  instances?: ScoutInstance[];
  stats?: ScoutStats;
}

function emptyStats(): ScoutStats {
  return { critical: 0, warning: 0, info: 0, breach: 0 };
}

function scoreLabel(score: number | null): string {
  if (score == null) return 'Loading...';
  if (score >= 80) return 'Healthy';
  if (score >= 60) return 'Fair';
  if (score > 0) return 'Needs attention';
  return 'No data';
}

function scoutDashboardInjection(): string {
  const accountId = process.env.SCOUT_OPERATOR_ACCOUNT_ID?.trim() ?? '';
  const accountJs = accountId ? JSON.stringify(accountId) : 'null';
  return [
    '<script>',
    'window.__SCOUT_KEY = \'\';',
    'window.__SCOUT_API_BASE = \'/scout-api\';',
    'window.__SCOUT_STREAM_URL = \'/scout/stream\';',
    'window.__SCOUT_ACCOUNT_ID = ' + accountJs + ';',
    '(function(){',
    '  const prefix = window.__SCOUT_API_BASE;',
    '  if (!prefix) return;',
    '  const appendAccount = function(url) {',
    '    if (!window.__SCOUT_ACCOUNT_ID || url.indexOf(\'account_id=\') !== -1) return url;',
    '    return url + (url.indexOf(\'?\') >= 0 ? \'&\' : \'?\') + \'account_id=\' + encodeURIComponent(window.__SCOUT_ACCOUNT_ID);',
    '  };',
    '  const rewrite = function(url) {',
    '    var target = url;',
    '    if (url && typeof url === \'object\' && \'url\' in url) target = url.url;',
    '    if (typeof target !== \'string\' || !target.startsWith(\'/api/\')) return url;',
    '    return appendAccount(prefix + target);',
    '  };',
    '  const orig = window.fetch.bind(window);',
    '  window.fetch = function(input, init) {',
    '    var opts = Object.assign({ credentials: \'same-origin\' }, init || {});',
    '    if (typeof input === \'string\') return orig(rewrite(input), opts);',
    '    if (input instanceof Request) {',
    '      var next = rewrite(input.url);',
    '      if (next !== input.url) input = new Request(next, input);',
    '    }',
    '    return orig(input, opts);',
    '  };',
    '})();',
    '</script>',
  ].join('');
}

function appendOperatorAccountId(url: string): string {
  const accountId = process.env.SCOUT_OPERATOR_ACCOUNT_ID?.trim();
  if (!accountId || url.includes('account_id=')) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}account_id=${encodeURIComponent(accountId)}`;
}

function appendOperatorInstanceId(url: string): string {
  const instanceId = process.env.SCOUT_OPERATOR_INSTANCE_ID?.trim();
  if (!instanceId || url.includes('instance_id=')) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}instance_id=${encodeURIComponent(instanceId)}`;
}

function dashboardOriginalPath(req: import('express').Request): string {
  return `${req.baseUrl}${req.url}`;
}

function isDashboardAssetRequest(req: import('express').Request): boolean {
  const originalPath = dashboardOriginalPath(req);
  return originalPath.startsWith('/dashboard/') && originalPath !== '/dashboard/';
}

async function proxyConsoleAsset(req: import('express').Request, res: import('express').Response): Promise<void> {
  const originalPath = dashboardOriginalPath(req);
  const targetUrl = `${SCOUT_CONSOLE_BASE}${originalPath}`;
  const abort = new AbortController();
  req.on('close', () => abort.abort());

  try {
    const upstream = await fetch(targetUrl, {
      method: req.method,
      signal: abort.signal,
    });

    res.status(upstream.status);
    const contentType = upstream.headers.get('content-type');
    if (contentType) res.setHeader('Content-Type', contentType);
    const cacheControl = upstream.headers.get('cache-control');
    if (cacheControl) res.setHeader('Cache-Control', cacheControl);

    if (upstream.body) {
      const isEventStream = contentType?.includes('text/event-stream') ?? false;
      if (isEventStream) {
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders?.();
        Readable.fromWeb(upstream.body as import('stream/web').ReadableStream).pipe(res);
        return;
      }

      const buf = Buffer.from(await upstream.arrayBuffer());
      res.send(buf);
      return;
    }

    res.end();
  } catch (err) {
    if (abort.signal.aborted) return;
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[ops] Scout console asset proxy failed:', msg);
    res.status(502).render('error', { message: 'Scout console unavailable: ' + msg });
  }
}

async function serveConsoleDashboard(res: import('express').Response): Promise<void> {
  try {
    const upstream = await fetch(`${SCOUT_CONSOLE_BASE}/embed/dashboard.html`, {
      headers: {
        Accept: 'text/html',
      },
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      throw new Error(`dashboard.html returned ${upstream.status}${text ? `: ${text.slice(0, 160)}` : ''}`);
    }

    const html = (await upstream.text()).replace('<!-- __SCOUT_KEY_INJECTION__ -->', scoutDashboardInjection());
    res.type('html').send(html);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[ops] Scout console serve failed:', msg);
    res.status(500).render('error', { message: 'Scout console unavailable: ' + msg });
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function scoutAccountPublicBase(): string {
  const raw = process.env.SCOUT_ACCOUNT_PUBLIC_URL?.trim()
    ?? process.env.SCOUT_CONSOLE_PUBLIC_URL?.trim()
    ?? 'https://console.labyrinthscout.com';
  return raw.replace(/\/$/, '');
}

async function renderScoutSummary(res: import('express').Response): Promise<void> {
  const scoutUrl = SCOUT_BASE;
  const data = (await scoutGet('/api/admin/status')) as StatusPayload | null;
  let score: number | null = null;

  if (data) {
    const scoreData = (await scoutGet('/api/score')) as { score?: number; overall?: number; value?: number } | null;
    score = scoreData?.score ?? scoreData?.overall ?? scoreData?.value ?? null;
  }

  const instances = data?.instances ?? [];
  const activeCount = instances.filter((i) => i.status === 'active').length;

  res.render('scout/index', {
    title: 'Scout Summary',
    scoutOnline: Boolean(data),
    scoutUrl,
    scoutConsolePublicUrl: scoutAccountPublicBase(),
    stats: data?.stats ?? emptyStats(),
    instances,
    activeCount,
    score,
    scoreLabel: scoreLabel(score),
  });
}

scoutDashboardRouter.get('/', (req, res) => {
  void renderScoutSummary(res);
});

scoutDashboardRouter.get('/console', (_req, res) => {
  // Scout console operator UI is public at console.labyrinthscout.com.
  // /embed/dashboard.html now redirects back to ops /scout, so do not proxy it.
  res.redirect(302, scoutAccountPublicBase());
});

scoutDashboardRouter.get('/summary', (req, res) => {
  void renderScoutSummary(res);
});

async function proxyScoutConsoleStream(req: import('express').Request, res: import('express').Response): Promise<void> {
  const targetUrl = appendOperatorAccountId(`${SCOUT_CONSOLE_BASE}/api/stream`);
  const scoutKey = scoutHeaders()['X-Scout-Key'];
  const headers: Record<string, string> = {};
  if (scoutKey) headers['X-Scout-Key'] = scoutKey;

  const abort = new AbortController();
  req.on('close', () => abort.abort());

  try {
    const upstream = await fetch(targetUrl, { headers, signal: abort.signal });

    res.status(upstream.status);
    const contentType = upstream.headers.get('content-type');
    if (contentType) res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    if (!upstream.ok || !upstream.body) {
      if (!contentType) res.setHeader('Content-Type', 'text/event-stream');
      res.write(`data: ${JSON.stringify({ type: 'offline', error: 'Scout stream unavailable' })}\n\n`);
      res.end();
      return;
    }

    res.flushHeaders?.();
    Readable.fromWeb(upstream.body as import('stream/web').ReadableStream).pipe(res);
  } catch (err) {
    if (abort.signal.aborted) return;
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[ops] Scout dashboard stream proxy failed:', msg);
    if (!res.headersSent) {
      res.status(502);
      res.setHeader('Content-Type', 'text/event-stream');
    }
    res.write(`data: ${JSON.stringify({ type: 'offline', error: msg })}\n\n`);
    res.end();
  }
}

scoutDashboardRouter.get('/stream', (req, res) => {
  void proxyScoutConsoleStream(req, res);
});

scoutDashboardRouter.use((req, res, next) => {
  if (!isDashboardAssetRequest(req)) {
    next();
    return;
  }
  void proxyConsoleAsset(req, res);
});

interface ScoutAccountRow {
  id: string;
  email: string;
  createdAt: string;
  isActive: boolean;
  subscriptionPlan: string;
  carinaTenantId: string | null;
  apiKeyCount: number;
  activeApiKeyCount: number;
}

scoutDashboardRouter.get('/accounts', async (req, res) => {
  const result = await scoutConsoleGetDetailed('/api/admin/accounts');
  const accounts = result.ok && result.data && typeof result.data === 'object' && 'accounts' in result.data
    ? (result.data as { accounts: ScoutAccountRow[] }).accounts
    : [];
  res.render('scout/accounts', {
    title: 'Scout Accounts',
    accounts,
    scoutConsoleUrl: SCOUT_CONSOLE_BASE,
    scoutAccountPublicUrl: scoutAccountPublicBase(),
    error: result.ok ? null : (result.error ?? 'Scout console unreachable'),
    query: req.query,
    resetUrl: typeof req.query.resetUrl === 'string' ? req.query.resetUrl : null,
    apiKey: typeof req.query.apiKey === 'string' ? req.query.apiKey : null,
    keyPrefix: typeof req.query.keyPrefix === 'string' ? req.query.keyPrefix : null,
  });
});

scoutDashboardRouter.post('/accounts/:id/deactivate', async (req, res) => {
  const id = String(req.params.id ?? '');
  if (!UUID_RE.test(id)) {
    res.redirect('/scout/accounts?error=Invalid+account');
    return;
  }
  const result = await scoutConsolePost(`/api/admin/accounts/${id}/deactivate`, {});
  if (!result.ok) {
    res.redirect(`/scout/accounts?error=${encodeURIComponent(result.error ?? 'Deactivate failed')}`);
    return;
  }
  res.redirect('/scout/accounts?deactivated=1');
});

scoutDashboardRouter.post('/accounts/:id/activate', async (req, res) => {
  const id = String(req.params.id ?? '');
  if (!UUID_RE.test(id)) {
    res.redirect('/scout/accounts?error=Invalid+account');
    return;
  }
  const result = await scoutConsolePost(`/api/admin/accounts/${id}/activate`, {});
  if (!result.ok) {
    res.redirect(`/scout/accounts?error=${encodeURIComponent(result.error ?? 'Activate failed')}`);
    return;
  }
  res.redirect('/scout/accounts?activated=1');
});

scoutDashboardRouter.post('/accounts/:id/reset-password', async (req, res) => {
  const id = String(req.params.id ?? '');
  if (!UUID_RE.test(id)) {
    res.redirect('/scout/accounts?error=Invalid+account');
    return;
  }
  const result = await scoutConsolePost(`/api/admin/accounts/${id}/reset-password`, {});
  if (!result.ok || !result.data || typeof result.data !== 'object') {
    res.redirect(`/scout/accounts?error=${encodeURIComponent(result.error ?? 'Reset failed')}`);
    return;
  }
  const setupToken = String((result.data as { setupToken?: string }).setupToken ?? '');
  if (!setupToken) {
    res.redirect('/scout/accounts?error=No+setup+token+returned');
    return;
  }
  const resetUrl = `${scoutAccountPublicBase()}/account/activate?token=${encodeURIComponent(setupToken)}`;
  res.redirect(`/scout/accounts?resetUrl=${encodeURIComponent(resetUrl)}`);
});

scoutDashboardRouter.post('/accounts/:id/reset-api-key', async (req, res) => {
  const id = String(req.params.id ?? '');
  if (!UUID_RE.test(id)) {
    res.redirect('/scout/accounts?error=Invalid+account');
    return;
  }
  const result = await scoutConsolePost(`/api/admin/accounts/${id}/reset-api-key`, {});
  if (!result.ok || !result.data || typeof result.data !== 'object') {
    res.redirect(`/scout/accounts?error=${encodeURIComponent(result.error ?? 'API key reset failed')}`);
    return;
  }
  const data = result.data as { apiKey?: string; keyPrefix?: string };
  const params = new URLSearchParams({ apiKey: data.apiKey ?? '', keyPrefix: data.keyPrefix ?? '' });
  res.redirect(`/scout/accounts?${params.toString()}`);
});

function scoutApiProxySuffix(req: import('express').Request): string {
  const original = req.originalUrl || req.url || '/';
  const withoutMount = original.startsWith('/scout-api')
    ? original.slice('/scout-api'.length) || '/'
    : (req.url.startsWith('/') ? req.url : `/${req.url}`);
  return withoutMount.startsWith('/') ? withoutMount : `/${withoutMount}`;
}

async function proxyToScout(req: import('express').Request, res: import('express').Response): Promise<void> {
  const suffix = scoutApiProxySuffix(req);
  const pathOnly = suffix.split('?')[0] || '/';
  const base = resolveScoutProxyBase(pathOnly, SCOUT_BASE, SCOUT_CONSOLE_BASE);
  const targetUrl = appendOperatorInstanceId(appendOperatorAccountId(`${base}${suffix}`));
  const headers = new Headers(scoutHeaders());
  // Always send the ops service key; never forward browser Authorization noise.
  headers.set('X-Scout-Key', scoutHeaders()['X-Scout-Key'] ?? '');
  headers.set('Content-Type', 'application/json');

  let body: string | undefined;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    body = typeof req.body === 'string'
      ? req.body
      : req.body && typeof req.body === 'object'
        ? JSON.stringify(req.body)
        : undefined;
    if (body === undefined) body = '{}';
  }

  const abort = new AbortController();
  // Only abort upstream if the client disconnects before we have started responding.
  let responded = false;
  req.on('close', () => {
    if (!responded) abort.abort();
  });

  try {
    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
      signal: abort.signal,
    });
    responded = true;

    res.status(upstream.status);
    const contentType = upstream.headers.get('content-type');
    if (contentType) res.setHeader('Content-Type', contentType);
    const cacheControl = upstream.headers.get('cache-control');
    if (cacheControl) res.setHeader('Cache-Control', cacheControl);

    const isEventStream = contentType?.includes('text/event-stream') ?? false;
    if (isEventStream && upstream.body) {
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders?.();
      Readable.fromWeb(upstream.body as import('stream/web').ReadableStream).pipe(res);
      return;
    }

    const buf = Buffer.from(await upstream.arrayBuffer());
    res.send(buf);
  } catch (err) {
    if (abort.signal.aborted) return;
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[ops] Scout dashboard API proxy failed:', msg);
    res.status(502).json({ error: 'Scout dashboard API unreachable', detail: msg });
  }
}

export const scoutApiProxyRouter = Router();
scoutApiProxyRouter.all('/*', (req, res) => {
  void proxyToScout(req, res);
});
