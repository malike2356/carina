import type { Request, Response } from 'express';

const SCOUT_ENGINE_URL = process.env.SCOUT_ENGINE_URL ?? '';
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
    method?: 'GET' | 'POST';
    path: string;
    body?: unknown;
  },
): Promise<boolean> {
  if (!scoutEngineEnabled()) return false;

  const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  const target = engineUrl(`${options.path}${options.method === 'GET' ? query : ''}`);

  try {
    const upstream = await fetch(target, {
      method: options.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Scout-Key': SCOUT_ENGINE_KEY,
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: AbortSignal.timeout(10_000),
    });

    const text = await upstream.text();
    res.status(upstream.status);
    const contentType = upstream.headers.get('content-type');
    if (contentType) res.setHeader('content-type', contentType);
    res.send(text);
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[scout-console] Engine proxy unavailable:', msg);
    return false;
  }
}
