function firstEnv(...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return undefined;
}

function internalServiceUrl(envKeys: string[], dockerDefault: string, localDefault: string): string {
  return firstEnv(...envKeys) ?? (process.env.NODE_ENV === 'production' ? dockerDefault : localDefault);
}

const SCOUT_ENGINE_URL = internalServiceUrl(
  ['SCOUT_ADMIN_API_URL', 'SCOUT_ENGINE_URL'],
  'http://scout-engine:4455',
  'http://127.0.0.1:4455',
);

const SCOUT_CONSOLE_URL = internalServiceUrl(
  ['SCOUT_CONSOLE_URL', 'SCOUT_URL'],
  'http://scout-console:4444',
  'http://127.0.0.1:4444',
);

const SCOUT_KEY = process.env.SCOUT_API_KEY ?? '';

/** Engine control plane (status, events, kill/resume). */
export const SCOUT_BASE = SCOUT_ENGINE_URL;

/** Console API (alert channels, platform settings). */
export const SCOUT_CONSOLE_BASE = SCOUT_CONSOLE_URL;

/** Full dashboard API surface (/api/status, /api/events, /api/stream, widgets). */
export const SCOUT_DASHBOARD_API = SCOUT_CONSOLE_URL;

export function scoutHeaders(): Record<string, string> {
  return {
    'X-Scout-Key': SCOUT_KEY,
    'Content-Type': 'application/json',
  };
}

export interface ScoutResponse {
  ok: boolean;
  status: number;
  data?: unknown;
  error?: string;
}

async function scoutRequest(baseUrl: string, method: string, path: string, body?: unknown): Promise<ScoutResponse> {
  try {
    const r = await fetch(`${baseUrl}${path}`, {
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

export async function scoutGet(path: string): Promise<unknown> {
  const result = await scoutRequest(SCOUT_ENGINE_URL, 'GET', path);
  return result.ok ? result.data : null;
}

export async function scoutPost(path: string, body: unknown): Promise<unknown> {
  const result = await scoutRequest(SCOUT_ENGINE_URL, 'POST', path, body);
  return result.ok ? result.data : null;
}

export async function scoutConsoleGet(path: string): Promise<unknown> {
  const result = await scoutRequest(SCOUT_CONSOLE_URL, 'GET', path);
  return result.ok ? result.data : null;
}

export async function scoutPut(path: string, body: unknown): Promise<ScoutResponse> {
  return scoutRequest(SCOUT_ENGINE_URL, 'PUT', path, body);
}

export async function scoutGetDetailed(path: string): Promise<ScoutResponse> {
  return scoutRequest(SCOUT_ENGINE_URL, 'GET', path);
}

export async function scoutConsoleGetDetailed(path: string): Promise<ScoutResponse> {
  return scoutRequest(SCOUT_CONSOLE_URL, 'GET', path);
}

export async function scoutConsolePut(path: string, body: unknown): Promise<ScoutResponse> {
  return scoutRequest(SCOUT_CONSOLE_URL, 'PUT', path, body);
}

export async function scoutConsolePost(path: string, body: unknown): Promise<ScoutResponse> {
  return scoutRequest(SCOUT_CONSOLE_URL, 'POST', path, body);
}

export function scoutStreamUrl(path: string): string {
  return `${SCOUT_ENGINE_URL}${path}`;
}

/**
 * Pick Scout engine vs console for /scout-api proxy paths.
 * Engine routes live under /api/admin/*; console owns /api/killswitch, /api/kill, widgets, etc.
 */
const ENGINE_ADMIN_PREFIXES = [
  '/api/admin/status',
  '/api/admin/events',
  '/api/admin/kill/',
  '/api/admin/resume/',
  '/api/v1/',
  '/api/warden',
];

export function resolveScoutProxyBase(
  pathname: string,
  engineBase: string = SCOUT_ENGINE_URL,
  consoleBase: string = SCOUT_CONSOLE_URL,
): string {
  if (ENGINE_ADMIN_PREFIXES.some((p) => pathname.startsWith(p))) {
    return engineBase;
  }
  return consoleBase;
}
