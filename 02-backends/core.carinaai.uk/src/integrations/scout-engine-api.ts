import type { ScoutApiConfig } from './scout-findings-types.js';

export class ScoutEngineApiError extends Error {
  constructor(
    message: string,
    readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'ScoutEngineApiError';
  }
}

export function resolveScoutEngineConfig(): ScoutApiConfig | null {
  const apiKey = process.env.SCOUT_ENGINE_API_KEY
    ?? process.env.SCOUT_API_KEY
    ?? process.env.LABYRINTH_API_KEY
    ?? '';
  const baseUrl = (
    process.env.SCOUT_ENGINE_URL
    ?? process.env.SCOUT_API_URL
    ?? process.env.LABYRINTH_URL
    ?? 'http://localhost:4444'
  ).replace(/\/+$/, '');

  if (!apiKey.trim() && process.env.SCOUT_AUTH_DISABLED !== 'true') return null;

  return {
    baseUrl,
    apiKey: apiKey.trim(),
    accountId: process.env.SCOUT_WORKSPACE_ID?.trim() || undefined,
  };
}

async function engineFetch<T>(
  config: ScoutApiConfig,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (config.apiKey) headers['X-Scout-Key'] = config.apiKey;
  if (config.accountId) headers['X-Workspace-Id'] = config.accountId;

  const response = await fetch(`${config.baseUrl}/api/v1${path}`, {
    ...init,
    headers,
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = await response.json() as { error?: string };
      detail = body.error ?? detail;
    } catch {
      /* ignore */
    }
    throw new ScoutEngineApiError(`Scout Engine API ${response.status}: ${detail}`, response.status);
  }

  return response.json() as Promise<T>;
}

export async function getEngineScoutScore(config: ScoutApiConfig): Promise<Record<string, unknown>> {
  return engineFetch(config, '/scout-score');
}

export async function getEngineScoutScoreHistory(
  config: ScoutApiConfig,
  days = 30,
): Promise<Array<Record<string, unknown>>> {
  return engineFetch(config, `/scout-score/history?days=${days}`);
}

export async function listEngineTargets(config: ScoutApiConfig): Promise<Array<Record<string, unknown>>> {
  const payload = await engineFetch<{ targets: Array<Record<string, unknown>> }>(config, '/targets');
  return payload.targets ?? [];
}

export async function addEngineTarget(
  config: ScoutApiConfig,
  input: { name: string; type: string; value: string; schedule?: string },
): Promise<Record<string, unknown>> {
  const payload = await engineFetch<{ target: Record<string, unknown> }>(config, '/targets', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return payload.target;
}

export async function triggerEngineScan(
  config: ScoutApiConfig,
  targetId: string,
  fastMode = false,
): Promise<{ scan_run_id: string }> {
  return engineFetch(config, `/targets/${encodeURIComponent(targetId)}/scan`, {
    method: 'POST',
    body: JSON.stringify({ fast_mode: fastMode }),
  });
}

export async function getEngineFinding(
  config: ScoutApiConfig,
  findingId: string,
): Promise<Record<string, unknown>> {
  const payload = await engineFetch<{ finding: Record<string, unknown> }>(
    config,
    `/findings/${encodeURIComponent(findingId)}`,
  );
  return payload.finding;
}

export async function listEngineAgents(config: ScoutApiConfig): Promise<Array<Record<string, unknown>>> {
  const payload = await engineFetch<{ agents: Array<Record<string, unknown>> }>(config, '/agents');
  return payload.agents ?? [];
}

export async function listEngineAlertRules(config: ScoutApiConfig): Promise<Array<Record<string, unknown>>> {
  const payload = await engineFetch<{ rules: Array<Record<string, unknown>> }>(config, '/alerts/rules');
  return payload.rules ?? [];
}

export async function testEngineAlert(
  config: ScoutApiConfig,
  ruleId: string,
): Promise<Record<string, unknown>> {
  return engineFetch(config, '/alerts/test', {
    method: 'POST',
    body: JSON.stringify({ rule_id: ruleId }),
  });
}

export async function getEngineComplianceScore(config: ScoutApiConfig): Promise<Record<string, unknown>> {
  return engineFetch(config, '/compliance/score');
}

export async function exportEngineCompliance(config: ScoutApiConfig): Promise<Record<string, unknown>> {
  return engineFetch(config, '/compliance/export', { method: 'POST', body: '{}' });
}
