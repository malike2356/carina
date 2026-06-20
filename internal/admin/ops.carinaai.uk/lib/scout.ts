const SCOUT_URL =
  process.env.SCOUT_ADMIN_API_URL ??
  process.env.SCOUT_ENGINE_URL ??
  'http://127.0.0.1:4444';
const SCOUT_KEY = process.env.SCOUT_API_KEY ?? '';

export const SCOUT_BASE = SCOUT_URL;

export function scoutHeaders(): Record<string, string> {
  return {
    'X-Scout-Key': SCOUT_KEY,
    'Content-Type': 'application/json',
  };
}

export async function scoutGet(path: string): Promise<unknown> {
  try {
    const r = await fetch(`${SCOUT_URL}${path}`, {
      headers: scoutHeaders(),
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) {
      console.warn(`[scout] GET ${path} returned ${r.status}`);
      return null;
    }
    return r.json();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[scout] offline:', msg);
    return null;
  }
}

export interface ScoutResponse {
  ok: boolean;
  status: number;
  data?: unknown;
  error?: string;
}

async function scoutRequest(method: string, path: string, body?: unknown): Promise<ScoutResponse> {
  try {
    const r = await fetch(`${SCOUT_URL}${path}`, {
      method,
      headers: scoutHeaders(),
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    const text = await r.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : undefined;
    } catch {
      data = text;
    }
    if (!r.ok) {
      const detail =
        typeof data === 'object' && data !== null && 'error' in data
          ? String((data as { error: unknown }).error)
          : text.slice(0, 200);
      console.warn(`[scout] ${method} ${path} returned ${r.status}: ${detail}`);
      return { ok: false, status: r.status, error: detail || `HTTP ${r.status}` };
    }
    return { ok: true, status: r.status, data };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[scout] offline:', msg);
    return { ok: false, status: 0, error: msg };
  }
}

export async function scoutPost(path: string, body: unknown): Promise<unknown> {
  const result = await scoutRequest('POST', path, body);
  return result.ok ? result.data : null;
}

export async function scoutPut(path: string, body: unknown): Promise<ScoutResponse> {
  return scoutRequest('PUT', path, body);
}

export async function scoutGetDetailed(path: string): Promise<ScoutResponse> {
  return scoutRequest('GET', path);
}

export function scoutStreamUrl(path: string): string {
  return `${SCOUT_URL}${path}`;
}
