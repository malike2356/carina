import type { Request, Response } from 'express';

const SCOUT_ENGINE_URL = process.env.SCOUT_ENGINE_URL?.trim()
  ?? (process.env.NODE_ENV === 'production' ? 'http://scout-engine:4455' : '');
const SCOUT_ENGINE_KEY = process.env.SCOUT_ENGINE_API_KEY ?? process.env.SCOUT_API_KEY ?? '';

export function scoutEngineEnabled(): boolean {
  return SCOUT_ENGINE_URL.trim().length > 0;
}

function engineUrl(path: string): string {
  return `${SCOUT_ENGINE_URL.replace(/\/+$/, '')}${path}`;
}

export async function proxyScoutEngineJson(
  req: Request,
  res: Response,
  options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    path: string;
    body?: unknown;
    headers?: Record<string, string>;
    query?: string;
  },
): Promise<boolean> {
  const result = await requestScoutEngineJson(req, options);
  if (!result) return false;

  res.status(result.status);
  if (result.contentType) {
    res.setHeader('content-type', result.contentType);
  }
  res.send(result.text);
  return true;
}

export async function requestScoutEngineJson(
  req: Request,
  options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    path: string;
    body?: unknown;
    headers?: Record<string, string>;
    query?: string;
  },
): Promise<{ status: number; text: string; contentType: string | null } | null> {
  if (!scoutEngineEnabled()) return null;

  const requestQuery = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  const extraQuery = options.query
    ? (options.query.startsWith('?') ? options.query : `?${options.query}`)
    : '';
  const target = options.method === 'GET'
    ? engineUrl(`${options.path}${requestQuery || extraQuery}${requestQuery && extraQuery ? `&${extraQuery.slice(1)}` : ''}`)
    : engineUrl(options.path);

  try {
    // Internal control routes auth on X-Scout-Internal-Key; other engine APIs use X-Scout-Key.
    const isInternalControl = options.path.startsWith('/api/internal/control');
    const upstream = await fetch(target, {
      method: options.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Scout-Key': SCOUT_ENGINE_KEY,
        ...(isInternalControl && SCOUT_ENGINE_KEY
          ? { 'X-Scout-Internal-Key': SCOUT_ENGINE_KEY }
          : {}),
        ...(options.headers ?? {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: AbortSignal.timeout(10_000),
    });

    const text = await upstream.text();
    return {
      status: upstream.status,
      text,
      contentType: upstream.headers.get('content-type'),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[scout-console] Engine proxy unavailable:', msg);
    return null;
  }
}
