import { keprixApiJson, readKeprixConfig } from '../integrations/keprix-api.js';
import type { WorkerPlaybookConfig } from '../types/index.js';

export type PlaybookRunTrigger = 'schedule' | 'manual' | 'inbound' | 'hire';

export interface StartPlaybookRunRequest {
  playbookId: string;
  workspaceId: string;
  variables?: Record<string, string | number | boolean>;
  initialState?: Record<string, unknown>;
  metadata?: {
    worker_id: string;
    tenant_id: string;
    template_id?: string;
    trigger: PlaybookRunTrigger;
  };
}

export interface PlaybookRunSummary {
  runId: string;
  graphId: string;
  status: string;
  workspaceId: string;
}

function buildInitialState(req: StartPlaybookRunRequest): Record<string, unknown> {
  const state: Record<string, unknown> = {
    ...(req.initialState ?? {}),
    ...(req.variables ?? {}),
  };
  if (req.metadata) {
    state._carina_worker_id = req.metadata.worker_id;
    state._carina_tenant_id = req.metadata.tenant_id;
    state._carina_template_id = req.metadata.template_id ?? req.playbookId;
    state._carina_trigger = req.metadata.trigger;
  }
  return state;
}

export async function startPlaybookRun(req: StartPlaybookRunRequest): Promise<PlaybookRunSummary> {
  const payload = {
    workspace_id: req.workspaceId,
    graph_id: req.playbookId,
    initial_state: buildInitialState(req),
  };
  const result = await keprixApiJson<{
    run_id: string;
    graph_id: string;
    status: string;
    workspace_id: string;
  }>('/api/playbook-runs/start', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return {
    runId: result.run_id,
    graphId: result.graph_id,
    status: result.status,
    workspaceId: result.workspace_id,
  };
}

export async function listPlaybookRuns(
  workspaceId: string,
  limit = 20,
): Promise<PlaybookRunSummary[]> {
  const result = await keprixApiJson<{
    runs?: Array<{
      run_id: string;
      graph_id: string;
      status: string;
      workspace_id: string;
    }>;
  }>(`/api/playbook-runs?workspace_id=${encodeURIComponent(workspaceId)}&limit=${limit}`);
  return (result.runs ?? []).map((run) => ({
    runId: run.run_id,
    graphId: run.graph_id,
    status: run.status,
    workspaceId: run.workspace_id,
  }));
}

export function buildKeprixRunUrl(runId: string): string {
  const base = readKeprixConfig().studioBaseUrl.replace(/\/$/, '');
  return `${base}/playbooks/${encodeURIComponent(runId)}`;
}

export async function startWorkerPlaybookRun(options: {
  workerId: string;
  workspaceId: string;
  playbook: WorkerPlaybookConfig;
  trigger: PlaybookRunTrigger;
  initialState?: Record<string, unknown>;
}): Promise<PlaybookRunSummary> {
  const graphId = options.playbook.keprixGraphId ?? options.playbook.playbookId;
  if (!graphId) {
    throw new Error('Worker playbook is not configured');
  }
  return startPlaybookRun({
    playbookId: graphId,
    workspaceId: options.workspaceId,
    variables: options.playbook.playbookVariables,
    initialState: options.initialState,
    metadata: {
      worker_id: options.workerId,
      tenant_id: options.workspaceId,
      template_id: options.playbook.playbookId,
      trigger: options.trigger,
    },
  });
}
