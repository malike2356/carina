import type { CatalogProbe, CatalogTool } from './catalog.js';

function applyTemplate(template: string, vars: Record<string, string>, encodeValues = false): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const raw = vars[key] ?? '';
    return encodeValues ? encodeURIComponent(raw) : raw;
  });
}

function applyTemplateDeep(value: unknown, vars: Record<string, string>): unknown {
  if (typeof value === 'string') return applyTemplate(value, vars);
  if (Array.isArray(value)) return value.map((item) => applyTemplateDeep(item, vars));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      out[key] = applyTemplateDeep(child, vars);
    }
    return out;
  }
  return value;
}

/**
 * Render Authorization from catalog authHeader templates.
 * - "Bearer {{token}}" / "Basic {{basic}}" / "X-Shopify-Access-Token {{token}}" as labeled
 * - "{{token}}" alone (ClickUp, Monday) = Authorization: <raw token>, no Bearer prefix
 * - "Authorization {{token}}" = same raw token
 */
export function applyAuthHeader(
  headers: Record<string, string>,
  authHeader: string | undefined,
  vars: Record<string, string>,
): void {
  if (!authHeader) return;
  const rendered = applyTemplate(authHeader, vars).trim();
  if (!rendered) return;

  if (rendered.startsWith('X-Shopify-Access-Token ')) {
    headers['X-Shopify-Access-Token'] = rendered.slice('X-Shopify-Access-Token '.length).trim();
    return;
  }
  if (/^basic\s+/i.test(rendered)) {
    headers.Authorization = rendered;
    return;
  }
  if (/^bearer\s+/i.test(rendered)) {
    headers.Authorization = rendered;
    return;
  }
  if (/^authorization\s+/i.test(rendered)) {
    headers.Authorization = rendered.replace(/^authorization\s+/i, '').trim();
    return;
  }
  // Bare token (ClickUp personal token, Monday API token): do not wrap with Bearer
  if (!rendered.includes(' ') && !rendered.includes(':')) {
    headers.Authorization = rendered;
    return;
  }
  headers.Authorization = rendered;
}

export async function runHttpProbeOrAction(opts: {
  tool: CatalogTool;
  probeOrAction: CatalogProbe & { method?: string; url?: string };
  vars: Record<string, string>;
  /** Optional JSON body merge from invoke input (POST/PATCH/PUT). */
  jsonBody?: unknown;
}): Promise<{ ok: boolean; status: number; body: string; json?: unknown }> {
  const spec = opts.probeOrAction;
  const method = (spec.method ?? 'GET').toUpperCase();
  const url = applyTemplate(String(spec.url ?? ''), opts.vars, true);
  if (!url || url.includes('{{')) {
    return { ok: false, status: 0, body: 'URL template incomplete; set config fields / vault values' };
  }

  const headers: Record<string, string> = {
    ...(spec.headers ?? {}),
  };
  for (const [key, value] of Object.entries(headers)) {
    headers[key] = applyTemplate(value, opts.vars);
  }
  applyAuthHeader(headers, spec.authHeader, opts.vars);

  const init: RequestInit = { method, headers, signal: AbortSignal.timeout(15000) };
  const baseJson = spec.json !== undefined ? applyTemplateDeep(spec.json, opts.vars) : undefined;
  let bodyJson = baseJson;
  if (opts.jsonBody !== undefined && method !== 'GET' && method !== 'HEAD') {
    if (
      bodyJson
      && typeof bodyJson === 'object'
      && !Array.isArray(bodyJson)
      && opts.jsonBody
      && typeof opts.jsonBody === 'object'
      && !Array.isArray(opts.jsonBody)
    ) {
      bodyJson = { ...(bodyJson as Record<string, unknown>), ...(opts.jsonBody as Record<string, unknown>) };
    } else {
      bodyJson = opts.jsonBody;
    }
  }
  if (bodyJson !== undefined && method !== 'GET' && method !== 'HEAD') {
    headers['Content-Type'] = headers['Content-Type'] ?? 'application/json';
    init.body = JSON.stringify(bodyJson);
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

/** Freshdesk API key auth: Basic base64(apiKey:X). */
export function buildFreshdeskBasic(apiKey: string): string {
  return Buffer.from(`${apiKey}:X`).toString('base64');
}

/** Mailchimp API key auth: Basic base64(anystring:apikey). */
export function buildMailchimpBasic(apiKey: string): string {
  return Buffer.from(`anystring:${apiKey}`).toString('base64');
}
