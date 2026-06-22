import type {
  ScoutApiConfig,
  ScoutFinding,
  ScoutFindingsList,
  ScoutFindingsQuery,
  ScoutFindingStatus,
  ScoutScoreSnapshot,
} from './scout-findings-types.js';

export class ScoutFindingsApiError extends Error {
  constructor(
    message: string,
    readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'ScoutFindingsApiError';
  }
}

export function resolveScoutApiConfig(): ScoutApiConfig | null {
  const apiKey = process.env.LABYRINTH_API_KEY
    ?? process.env.SCOUT_API_KEY
    ?? '';
  const baseUrl = (
    process.env.SCOUT_API_URL
    ?? process.env.SCOUT_BASE_URL
    ?? process.env.LABYRINTH_URL
    ?? process.env.LABYRINTH_SCOUT_URL
    ?? (process.env.NODE_ENV === 'production' ? 'http://labyrinth-scout:4444' : 'http://localhost:4444')
  ).replace(/\/+$/, '');

  if (!apiKey.trim()) return null;

  const accountId = process.env.SCOUT_ACCOUNT_ID?.trim() || undefined;
  return { baseUrl, apiKey: apiKey.trim(), accountId };
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

async function scoutFetch<T>(
  config: ScoutApiConfig,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${config.baseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-Scout-Key': config.apiKey,
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = await response.json() as { error?: string; detail?: string };
      detail = body.detail ?? body.error ?? detail;
    } catch {
      /* ignore */
    }
    throw new ScoutFindingsApiError(
      `Scout API ${response.status}: ${detail}`,
      response.status,
    );
  }

  return response.json() as Promise<T>;
}

export async function listScoutFindings(
  config: ScoutApiConfig,
  query: ScoutFindingsQuery = {},
): Promise<ScoutFinding[]> {
  const qs = buildQuery({
    severity: query.severity,
    status: query.status,
    tool: query.tool,
    target_id: query.targetId,
    limit: query.limit,
    offset: query.offset,
    account_id: query.accountId ?? config.accountId,
  });
  const payload = await scoutFetch<ScoutFindingsList>(config, `/api/findings${qs}`);
  return payload.findings ?? [];
}

export async function getScoutFinding(
  config: ScoutApiConfig,
  findingId: string,
): Promise<ScoutFinding> {
  const qs = buildQuery({ account_id: config.accountId });
  return scoutFetch<ScoutFinding>(config, `/api/findings/${encodeURIComponent(findingId)}${qs}`);
}

export async function updateScoutFindingStatus(
  config: ScoutApiConfig,
  findingId: string,
  status: ScoutFindingStatus,
): Promise<ScoutFinding> {
  const qs = buildQuery({ account_id: config.accountId });
  return scoutFetch<ScoutFinding>(config, `/api/findings/${encodeURIComponent(findingId)}${qs}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function getScoutScore(config: ScoutApiConfig): Promise<ScoutScoreSnapshot> {
  const qs = buildQuery({ account_id: config.accountId });
  return scoutFetch<ScoutScoreSnapshot>(config, `/api/score${qs}`);
}

export interface ScoutTarget {
  id: string;
  target: string;
  targetType: string;
  label: string | null;
  isActive: boolean;
}

export async function listScoutTargets(config: ScoutApiConfig): Promise<ScoutTarget[]> {
  const qs = buildQuery({ account_id: config.accountId });
  const payload = await scoutFetch<{ targets: ScoutTarget[] }>(config, `/api/targets${qs}`);
  return payload.targets ?? [];
}

export async function queueScoutScan(
  config: ScoutApiConfig,
  targetId: string,
  tool = 'quick-scan',
): Promise<{ id: string; status: string; tool: string }> {
  const qs = buildQuery({ account_id: config.accountId });
  return scoutFetch(config, `/api/targets/${encodeURIComponent(targetId)}/scan${qs}`, {
    method: 'POST',
    body: JSON.stringify({ tool }),
  });
}

export async function requestScoutInvestigation(
  config: ScoutApiConfig,
  findingId: string,
  operatorId?: string,
): Promise<unknown> {
  const qs = buildQuery({ account_id: config.accountId });
  return scoutFetch(config, `/api/findings/${encodeURIComponent(findingId)}/investigate${qs}`, {
    method: 'POST',
    body: JSON.stringify({ operator_id: operatorId ?? process.env.USER ?? 'carina-cli' }),
  });
}

export async function fetchScoutStixBundle(
  config: ScoutApiConfig,
  targetId?: string,
): Promise<Record<string, unknown>> {
  const qs = buildQuery({ account_id: config.accountId, target_id: targetId, cve_only: 'true' });
  return scoutFetch<Record<string, unknown>>(config, `/api/reports/stix${qs}`);
}

export async function fetchAttackSurfaceSummary(
  config: ScoutApiConfig,
): Promise<Record<string, unknown>> {
  const qs = buildQuery({ account_id: config.accountId });
  return scoutFetch<Record<string, unknown>>(config, `/api/attack-surface/summary${qs}`);
}
