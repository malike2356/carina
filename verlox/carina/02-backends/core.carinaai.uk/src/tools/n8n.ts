import type { Tool } from '../types/index.js';
import { config } from '../config/index.js';

function resolveBaseUrl(params: Record<string, unknown>): string {
  const raw = String(params.base_url ?? process.env.N8N_BASE_URL ?? config.n8n.baseUrl ?? '').trim();
  return raw.replace(/\/$/, '');
}

function resolveApiKey(params: Record<string, unknown>): string {
  return String(params.api_key ?? process.env.N8N_API_KEY ?? config.n8n.apiKey ?? '');
}

async function n8nFetch(
  path: string,
  method: 'GET' | 'POST',
  body: Record<string, unknown> | undefined,
  baseUrl: string,
  apiKey: string,
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const base = baseUrl.replace(/\/$/, '');
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;

  const response = await fetch(url, {
    method,
    headers: {
      'X-N8N-API-KEY': apiKey,
      'Content-Type': 'application/json',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });

  const text = await response.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  return { ok: response.ok, status: response.status, data };
}

export const n8nTool: Tool = {
  name: 'n8n',
  dangerous: true,
  description:
    'Interact with n8n workflow automation. Actions: trigger (run a workflow or webhook), status (check execution), list (list workflows).',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['trigger', 'status', 'list'] },
      workflow_id: { type: 'string', description: 'Workflow UUID, integer ID, or webhook path (trigger)' },
      payload: { type: 'object', description: 'JSON body sent to the workflow (trigger)' },
      execution_id: { type: 'string', description: 'n8n execution ID (status)' },
      base_url: { type: 'string', description: 'Override N8N_BASE_URL for this call' },
      api_key: { type: 'string', description: 'Override N8N_API_KEY for this call' },
    },
    required: ['action'],
  },
  needsConfirmation: (params) => params.action === 'trigger',
  execute: async (params) => {
    const action = String(params.action ?? '');

    try {
      if (action === 'trigger') {
        const base = resolveBaseUrl(params);
        const key = resolveApiKey(params);
        if (!base) return { error: 'N8N_BASE_URL is not set' };

        const id = String(params.workflow_id ?? '').trim();
        if (!id) return { error: 'workflow_id is required for trigger' };

        const path = id.includes('/')
          ? `/webhook/${id}`
          : `/api/v1/workflows/${encodeURIComponent(id)}/run`;
        const payload = (params.payload ?? {}) as Record<string, unknown>;

        const result = await n8nFetch(path, 'POST', payload, base, key);
        if (result.status === 404) return { error: `workflow ${id} not found` };
        if (result.status === 200 || result.status === 201) {
          const data = result.data as Record<string, unknown>;
          return {
            triggered: true,
            execution_id: data.executionId ?? null,
            status: data.status ?? 'running',
          };
        }
        return { error: `n8n returned ${result.status}` };
      }

      if (action === 'status') {
        const base = resolveBaseUrl(params);
        const key = resolveApiKey(params);
        if (!base) return { error: 'N8N_BASE_URL is not set' };

        const execId = String(params.execution_id ?? '').trim();
        if (!execId) return { error: 'execution_id is required for status' };

        const result = await n8nFetch(
          `/api/v1/executions/${encodeURIComponent(execId)}`,
          'GET',
          undefined,
          base,
          key,
        );
        if (result.status === 404) return { error: `execution ${execId} not found` };
        if (result.status === 200) {
          const data = result.data as Record<string, unknown>;
          const startedAt = data.startedAt ? String(data.startedAt) : null;
          const stoppedAt = data.stoppedAt ? String(data.stoppedAt) : null;
          return {
            execution_id: data.id,
            status: data.status,
            finished: data.finished,
            started_at: startedAt,
            stopped_at: stoppedAt ?? null,
            duration_ms:
              stoppedAt && startedAt
                ? new Date(stoppedAt).getTime() - new Date(startedAt).getTime()
                : null,
          };
        }
        return { error: `n8n returned ${result.status}` };
      }

      if (action === 'list') {
        const base = resolveBaseUrl(params);
        const key = resolveApiKey(params);
        if (!base) return { error: 'N8N_BASE_URL is not set' };

        const result = await n8nFetch('/api/v1/workflows', 'GET', undefined, base, key);
        if (result.status === 200) {
          const data = result.data as { data?: unknown[] };
          const workflows = (data.data ?? []).map((w) => {
            const workflow = w as Record<string, unknown>;
            return {
              id: workflow.id,
              name: workflow.name,
              active: workflow.active,
              updated_at: workflow.updatedAt,
            };
          });
          return { workflows };
        }
        return { error: `n8n returned ${result.status}` };
      }

      return { error: `unknown action: ${action}` };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { error: msg };
    }
  },
};
