import type { CatalogProbe, CatalogTool } from './catalog.js';

function applyTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? '');
}

export async function runHttpProbeOrAction(opts: {
  tool: CatalogTool;
  probeOrAction: CatalogProbe & { method?: string; url?: string };
  vars: Record<string, string>;
}): Promise<{ ok: boolean; status: number; body: string; json?: unknown }> {
  const spec = opts.probeOrAction;
  const method = (spec.method ?? 'GET').toUpperCase();
  const url = applyTemplate(String(spec.url ?? ''), opts.vars);
  if (!url || url.includes('{{')) {
    return { ok: false, status: 0, body: 'URL template incomplete; set config fields / vault values' };
  }

  const headers: Record<string, string> = {
    ...(spec.headers ?? {}),
  };
  for (const [key, value] of Object.entries(headers)) {
    headers[key] = applyTemplate(value, opts.vars);
  }
  if (spec.authHeader) {
    const rendered = applyTemplate(spec.authHeader, opts.vars);
    if (rendered.startsWith('X-Shopify-Access-Token ')) {
      headers['X-Shopify-Access-Token'] = rendered.slice('X-Shopify-Access-Token '.length);
    } else if (rendered.startsWith('Basic ')) {
      headers.Authorization = rendered;
    } else if (rendered.startsWith('Bearer ')) {
      headers.Authorization = rendered;
    } else {
      headers.Authorization = rendered.includes(' ') ? rendered : `Bearer ${rendered}`;
    }
  }

  const init: RequestInit = { method, headers, signal: AbortSignal.timeout(15000) };
  if (spec.json !== undefined && method !== 'GET' && method !== 'HEAD') {
    headers['Content-Type'] = headers['Content-Type'] ?? 'application/json';
    init.body = JSON.stringify(spec.json);
  }

  const response = await fetch(url, init);
  const body = await response.text();
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    json = undefined;
  }
  return {
    ok: response.ok,
    status: response.status,
    body: body.slice(0, 4000),
    json,
  };
}

export function buildBasicAuth(email: string, token: string): string {
  return `Basic ${Buffer.from(`${email}/token:${token}`).toString('base64')}`;
}

export function buildBasicUserPass(user: string, pass: string): string {
  return `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
}
