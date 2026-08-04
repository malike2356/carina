import { Readable } from 'stream';
import { Router } from 'express';
import type { Request, Response } from 'express';

function adminInternalBase(): string {
  return (process.env.CARINA_ADMIN_INTERNAL_URL ?? 'http://127.0.0.1:4200').replace(/\/$/, '');
}

function bridgeSecret(): string {
  return process.env.OPS_BRIDGE_SECRET ?? process.env.SESSION_SECRET ?? 'change-me-in-production';
}

function adminBasePath(): string {
  return (process.env.ADMIN_BASE_PATH ?? '/business-inner').replace(/\/$/, '');
}

function buildTargetUrl(req: Request): string {
  const base = adminInternalBase();
  const suffix = req.url.startsWith('/') ? req.url : `/${req.url}`;
  return `${base}${adminBasePath()}${suffix}`;
}

function collapseDuplicateBasePath(req: Request): void {
  const base = adminBasePath();
  if (req.path === base || req.path.startsWith(`${base}/`)) {
    const rest = req.path === base ? '/' : req.path.slice(base.length);
    const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    req.url = `${rest || '/'}${query}`;
  }
}

function businessPageSuffix(req: Request): { suffix: string; query: string } {
  const suffix = req.path === '/' ? '/customers' : req.path;
  const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  return { suffix, query };
}

/** Ensure iframe document requests never re-enter the ops shell (nested sidebar). */
function withEmbedQuery(query: string): string {
  const raw = query.startsWith('?') ? query.slice(1) : query;
  const params = new URLSearchParams(raw);
  params.set('embed', '1');
  return `?${params.toString()}`;
}

function isEmbedRequest(req: Request): boolean {
  const embed = req.query['embed'];
  if (embed === '1' || embed === 'true') return true;
  const dest = (req.get('sec-fetch-dest') ?? '').toLowerCase();
  if (dest === 'iframe') return true;
  // Some browsers omit Sec-Fetch-Dest; treat same-origin iframe referrers as embed.
  const destMissing = !dest;
  const fetchSite = (req.get('sec-fetch-site') ?? '').toLowerCase();
  const referer = req.get('referer') ?? '';
  if (
    destMissing
    && fetchSite === 'same-origin'
    && /\/business-inner(\/|\?|$)/.test(referer)
  ) {
    return true;
  }
  return false;
}

/** Top-level browser navigation: ops sidebar + iframe. Iframe loads use direct proxy. */
function wantsBusinessShell(req: Request): boolean {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;
  const accept = req.get('accept') ?? '';
  if (!accept.includes('text/html')) return false;
  if (isEmbedRequest(req)) return false;
  return true;
}

function renderBusinessShell(req: Request, res: Response): void {
  if (!req.session?.adminToken) {
    res.status(403).render('error', {
      title: 'Business access required',
      message: 'Your session has ops access but not Aiva business admin. Sign out, then sign in again with your admin_operators email and complete 2FA if prompted, or use Google sign-in with the same email.',
    });
    return;
  }

  const { suffix, query } = businessPageSuffix(req);
  res.render('business-shell', {
    title: 'Business',
    // Always force embed=1 so the iframe never gets another ops shell (nested view).
    frameSrc: `/business-inner${suffix}${withEmbedQuery(query)}`,
  });
}

type ProxyOptions = {
  requireAdminToken?: boolean;
};

async function proxyBusinessAdminRequest(
  req: Request,
  res: Response,
  options: ProxyOptions = {},
): Promise<void> {
  const requireAdminToken = options.requireAdminToken !== false;
  const adminToken = req.session?.adminToken;
  if (requireAdminToken && !adminToken) {
    const wantsJson = (req.get('accept') ?? '').includes('application/json')
      || (req.originalUrl ?? '').includes('/api/admin');
    if (wantsJson) {
      res.status(403).json({
        error: 'Business admin access required. Sign out and sign in again with your admin operator email.',
      });
      return;
    }
    res.status(403).render('error', {
      title: 'Business access required',
      message: 'Your session has ops access but not Aiva business admin. Sign out, then sign in again with your admin_operators email and complete 2FA if prompted, or use Google sign-in with the same email.',
      bare: true,
    });
    return;
  }

  const targetUrl = buildTargetUrl(req);
  const abort = new AbortController();
  req.on('close', () => abort.abort());

  const headers: Record<string, string> = {
    Accept: req.get('accept') ?? '*/*',
  };
  if (adminToken) {
    headers['X-Ops-Admin-Token'] = adminToken;
    headers['X-Ops-Trusted-Proxy'] = bridgeSecret();
    headers['X-Ops-Embed'] = '1';
    if (req.session?.adminEmail) {
      headers['X-Ops-Admin-Email'] = req.session.adminEmail;
    }
  }
  const contentType = req.get('content-type');
  if (contentType) headers['Content-Type'] = contentType;

  let fetchBody: string | undefined;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    if (contentType?.includes('application/json')) {
      fetchBody = JSON.stringify(req.body ?? {});
    } else if (req.body !== undefined && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
      headers['Content-Type'] = headers['Content-Type'] ?? 'application/json';
      fetchBody = JSON.stringify(req.body);
    } else if (typeof req.body === 'string') {
      fetchBody = req.body;
    }
  }

  try {
    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: fetchBody,
      signal: abort.signal,
      redirect: 'manual',
    });

    if (upstream.status >= 300 && upstream.status < 400) {
      const location = upstream.headers.get('location');
      if (location) {
        const basePath = adminBasePath();
        const inner = location.replace(adminInternalBase(), '').replace(new RegExp(`^${basePath}`), '');
        const pathAndQuery = inner.startsWith('/') ? inner : `/${inner}`;
        const qIndex = pathAndQuery.indexOf('?');
        const pathOnly = qIndex === -1 ? pathAndQuery : pathAndQuery.slice(0, qIndex);
        const queryOnly = qIndex === -1 ? '' : pathAndQuery.slice(qIndex);
        const keepEmbed = isEmbedRequest(req);
        const nextQuery = keepEmbed ? withEmbedQuery(queryOnly) : queryOnly;
        res.redirect(upstream.status, `/business-inner${pathOnly}${nextQuery}`);
        return;
      }
    }

    res.status(upstream.status);
    upstream.headers.forEach((value, key) => {
      const lower = key.toLowerCase();
      if (
        lower === 'transfer-encoding'
        || lower === 'connection'
        || lower === 'set-cookie'
        || lower === 'content-encoding'
        || lower === 'content-length'
      ) {
        return;
      }
      res.setHeader(key, value);
    });

    const upstreamType = upstream.headers.get('content-type') ?? '';
    const isEventStream = upstreamType.includes('text/event-stream');

    if (upstream.body) {
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
    console.error('[ops] business admin proxy failed:', msg);
    const wantsJson = (req.get('accept') ?? '').includes('application/json')
      || (req.originalUrl ?? '').includes('/api/admin');
    if (wantsJson) {
      res.status(502).json({ error: `Business admin unavailable: ${msg}` });
      return;
    }
    res.status(502).render('error', { message: `Business admin unavailable: ${msg}`, bare: true });
  }
}

export const businessAdminProxyRouter = Router();
businessAdminProxyRouter.all('*', (req, res) => {
  collapseDuplicateBasePath(req);
  if (wantsBusinessShell(req)) {
    if (req.method === 'HEAD') {
      res.status(200).end();
      return;
    }
    renderBusinessShell(req, res);
    return;
  }
  void proxyBusinessAdminRequest(req, res);
});

/** Next.js hashed assets; ops session only (no admin token bridge race). */
export const businessAdminStaticProxyRouter = Router();
businessAdminStaticProxyRouter.all('*', (req, res) => {
  const suffix = req.url.startsWith('/') ? req.url : `/${req.url}`;
  req.url = `/_next${suffix}`;
  void proxyBusinessAdminRequest(req, res, { requireAdminToken: false });
});

export const businessAdminApiProxyRouter = Router();
businessAdminApiProxyRouter.all('*', (req, res) => {
  const suffix = req.url.startsWith('/') ? req.url : `/${req.url}`;
  req.url = `/api/admin${suffix}`;
  void proxyBusinessAdminRequest(req, res);
});

export const businessAdminShellRouter = Router();

businessAdminShellRouter.get('/', (_req, res) => {
  res.redirect(302, '/business-inner/customers');
});

/** Legacy /business/* URLs redirect to full-page admin (no iframe). */
businessAdminShellRouter.get(/.*/, (req, res) => {
  if (!req.session?.adminToken) {
    res.status(403).render('error', {
      title: 'Business access required',
      message: 'Your session has ops access but not Aiva business admin. Sign out, then sign in again with your admin_operators email and complete 2FA if prompted, or use Google sign-in with the same email.',
    });
    return;
  }

  const { suffix, query } = businessPageSuffix(req);
  res.redirect(302, `/business-inner${suffix}${query}`);
});
