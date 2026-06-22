import { coreProxyEnabled, resolveCoreProxyToken, resolveCoreUrl } from '@/lib/core-proxy';

export type EnvironmentSetting = {
  key: string;
  value: string;
  source: 'process' | 'derived';
  sensitive: boolean;
};

export type EnvironmentSummary = {
  generatedAt: string;
  carinaHome: string;
  envPath: string;
  envExists: boolean;
  envMode: string | null;
  settings: EnvironmentSetting[];
  audit: { ok: number; warn: number; fail: number };
  findings: Array<{
    id: string;
    severity: 'ok' | 'warn' | 'fail';
    source: string;
    key: string;
    detail: string;
  }>;
  precedenceDrift: string[];
  unresolvedRefs: string[];
};

function coreAuthHeaders(): Record<string, string> {
  const token = resolveCoreProxyToken();
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
    headers['x-internal-key'] = token;
  }
  return headers;
}

async function readJsonResponse<T>(response: Response, label: string): Promise<T> {
  const text = await response.text();
  if (!text.trim()) {
    throw new Error(`${label} returned an empty response (HTTP ${response.status}). Check CARINA_CORE_URL and core ops auth.`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    const preview = text.slice(0, 160).replace(/\s+/g, ' ');
    throw new Error(`${label} returned non-JSON (HTTP ${response.status}): ${preview}`);
  }
}

export function environmentCoreConfigured(): boolean {
  return coreProxyEnabled();
}

export async function fetchEnvironmentFromCore(): Promise<EnvironmentSummary> {
  const coreUrl = resolveCoreUrl().replace(/\/$/, '');
  const response = await fetch(`${coreUrl}/api/ops/environment`, {
    headers: coreAuthHeaders(),
    cache: 'no-store',
    signal: AbortSignal.timeout(20_000),
  });
  const body = await readJsonResponse<{ environment?: EnvironmentSummary; error?: string }>(
    response,
    'Core environment summary',
  );
  if (!response.ok) {
    throw new Error(body.error ?? `Core environment summary failed (HTTP ${response.status})`);
  }
  if (!body.environment) {
    throw new Error('Core environment summary did not include environment data.');
  }
  return body.environment;
}

export async function reloadEnvironmentOnCore(): Promise<{ reloaded: number; skipped: number }> {
  const coreUrl = resolveCoreUrl().replace(/\/$/, '');
  const response = await fetch(`${coreUrl}/api/ops/reload-secrets`, {
    method: 'POST',
    headers: coreAuthHeaders(),
    signal: AbortSignal.timeout(20_000),
  });
  const body = await readJsonResponse<{
    ok?: boolean;
    reloaded?: number;
    skipped?: number;
    error?: string;
  }>(response, 'Core secrets reload');
  if (!response.ok || body.ok === false) {
    throw new Error(body.error ?? `Core secrets reload failed (HTTP ${response.status})`);
  }
  return {
    reloaded: body.reloaded ?? 0,
    skipped: body.skipped ?? 0,
  };
}

export function buildDevEnvironmentStub(): EnvironmentSummary {
  const now = new Date().toISOString();
  return {
    generatedAt: now,
    carinaHome: '(not connected to core)',
    envPath: '(unavailable in cloud-only mode)',
    envExists: false,
    envMode: null,
    settings: [],
    audit: { ok: 0, warn: 0, fail: 0 },
    findings: [],
    precedenceDrift: [],
    unresolvedRefs: [],
  };
}
