import { getStudioHandoffUrl } from './agent-studio-playbook-bridge.js';
import { isKeprixStudioConfigured, readKeprixConfig } from './keprix-config.js';

export type PlaybookSummary = {
  id: string;
  name: string;
  updated_at: string;
  status?: string;
};

export class KeprixProxyError extends Error {
  readonly status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.name = 'KeprixProxyError';
    this.status = status;
  }
}

type HandoffContext = {
  subject: string;
  tenantId: string;
  carinaUserId: string;
};

function parsePlaybookSummary(raw: unknown): PlaybookSummary | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const id = String(row.id ?? '').trim();
  const name = String(row.name ?? '').trim();
  const updatedAt = String(row.updated_at ?? row.updatedAt ?? '').trim();
  if (!id || !name) return null;
  const status = row.status != null ? String(row.status) : undefined;
  return {
    id,
    name,
    updated_at: updatedAt || new Date(0).toISOString(),
    status,
  };
}

export async function listPlaybooks(): Promise<PlaybookSummary[]> {
  const config = readKeprixConfig();
  if (!isKeprixStudioConfigured(config)) {
    throw new KeprixProxyError('Keprix studio is not configured', 503);
  }
  if (!config.serviceToken) {
    throw new KeprixProxyError('KEPRIX_SERVICE_TOKEN is not configured', 503);
  }

  const url = `${config.apiBaseUrl}/api/playbooks/studio`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${config.serviceToken}`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new KeprixProxyError(`Keprix studio list failed: ${message}`, 502);
  }

  if (!response.ok) {
    throw new KeprixProxyError(`Keprix studio list returned ${response.status}`, response.status);
  }

  const payload = (await response.json()) as { playbooks?: unknown[] };
  const rows = Array.isArray(payload.playbooks) ? payload.playbooks : [];
  return rows
    .map((row) => parsePlaybookSummary(row))
    .filter((row): row is PlaybookSummary => row != null);
}

export async function getPlaybookRunUrl(
  runId: string,
  context: HandoffContext,
): Promise<string> {
  const trimmed = runId.trim();
  if (!trimmed) {
    throw new KeprixProxyError('runId is required', 400);
  }
  return getStudioHandoffUrl(`/playbooks/${encodeURIComponent(trimmed)}`, context);
}

export async function getPlaybookStudioUrl(
  playbookId: string | 'new',
  context: HandoffContext,
): Promise<string> {
  const path =
    playbookId === 'new'
      ? '/playbooks/studio/new'
      : `/playbooks/studio/${encodeURIComponent(playbookId)}`;
  return getStudioHandoffUrl(path, context);
}
