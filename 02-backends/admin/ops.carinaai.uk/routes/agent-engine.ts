import { Router } from 'express';
import {
  carinaGet,
  carinaJson,
  carinaOpsTokenSet,
  carinaPatch,
  carinaPost,
} from '../lib/carina.js';
import { hrefWithUiVersion } from '../lib/callback-url.js';
import { writeOpsAudit } from '../lib/tenant-audit.js';

export const agentEngineRouter = Router();

const uiVersion = process.env.UI_VERSION ?? '20260719a';

type Health = {
  engine?: string;
  status?: string;
  uptime_seconds?: number | null;
  version?: string | null;
  active_sessions?: number | null;
  memory_usage_mb?: number | null;
  cpu_percent?: number | null;
  last_error?: string | null;
  error?: string;
};

type Config = {
  global_engine?: string;
  keprix_url?: string;
  default_model?: string;
  max_iterations?: number;
  timeout_seconds?: number;
  prompt_filter_enabled?: boolean;
  kill_switch_enabled?: boolean;
  scout_integration_enabled?: boolean;
  error?: string;
};

type WorkspacesPayload = {
  workspaces?: Array<{ id: string; name: string; engine: string; status?: string }>;
  summary?: { total: number; on_keprix: number; on_carina: number };
  source?: string;
  error?: string;
};

function redirect(query: Record<string, string>): string {
  const params = new URLSearchParams(query);
  return hrefWithUiVersion(`/agent-engine?${params.toString()}`, uiVersion);
}

function actor(req: { session?: unknown }): string {
  const s = (req.session && typeof req.session === 'object')
    ? (req.session as Record<string, unknown>)
    : {};
  return String(s.email ?? s.userName ?? s.userId ?? 'ops-admin');
}

async function loadPageData(): Promise<{
  health: Health;
  config: Config;
  workspaces: WorkspacesPayload;
  logs: Array<Record<string, unknown>>;
  meta: Record<string, unknown>;
}> {
  if (!carinaOpsTokenSet()) {
    const err = 'Pair Carina in Settings first (CARINA_OPS_TOKEN).';
    return {
      health: { status: 'unreachable', error: err },
      config: { error: err },
      workspaces: { workspaces: [], summary: { total: 0, on_keprix: 0, on_carina: 0 }, error: err },
      logs: [],
      meta: {},
    };
  }

  const [healthRes, configRes, wsRes, logsRes, metaRes] = await Promise.all([
    carinaGet('/api/ops/agent-engine/health', 8000),
    carinaGet('/api/ops/agent-engine/config', 8000),
    carinaGet('/api/ops/agent-engine/workspaces', 8000),
    carinaGet('/api/ops/agent-engine/logs?limit=50', 8000),
    carinaGet('/api/ops/agent-engine/meta', 8000),
  ]);

  const health = await carinaJson<Health>(healthRes);
  const config = await carinaJson<Config>(configRes);
  const workspaces = await carinaJson<WorkspacesPayload>(wsRes);
  const logsBody = await carinaJson<{ logs?: Array<Record<string, unknown>> }>(logsRes);
  const meta = await carinaJson<Record<string, unknown>>(metaRes);

  return {
    health: health.data ?? { status: 'unreachable', error: health.error },
    config: config.data ?? { error: config.error },
    workspaces: workspaces.data ?? {
      workspaces: [],
      summary: { total: 0, on_keprix: 0, on_carina: 0 },
      error: workspaces.error,
    },
    logs: logsBody.data?.logs ?? [],
    meta: meta.data ?? {},
  };
}

agentEngineRouter.get('/', async (req, res) => {
  const data = await loadPageData();
  res.render('agent-engine', {
    title: 'Agent Engine',
    flashOk: typeof req.query.ok === 'string' ? req.query.ok : '',
    flashErr: typeof req.query.err === 'string' ? req.query.err : '',
    ...data,
  });
});

agentEngineRouter.post('/config', async (req, res) => {
  try {
    const body = {
      default_model: String(req.body.default_model ?? '').trim() || undefined,
      max_iterations: req.body.max_iterations ? Number(req.body.max_iterations) : undefined,
      timeout_seconds: req.body.timeout_seconds ? Number(req.body.timeout_seconds) : undefined,
      global_engine: String(req.body.global_engine ?? '').trim() || undefined,
      keprix_url: String(req.body.keprix_url ?? '').trim() || undefined,
    };
    const response = await carinaPatch('/api/ops/agent-engine/config', body);
    const parsed = await carinaJson(response);
    await writeOpsAudit({
      action: 'agent_engine.config_patch',
      actor: actor(req),
      details: body,
    });
    if (!parsed.ok) {
      res.redirect(redirect({ err: parsed.error ?? 'Config update failed' }));
      return;
    }
    res.redirect(redirect({ ok: 'Configuration saved' }));
  } catch (err) {
    res.redirect(redirect({ err: err instanceof Error ? err.message : String(err) }));
  }
});

agentEngineRouter.post('/workspaces/:id/switch', async (req, res) => {
  try {
    const engine = String(req.body.engine ?? '').trim();
    const response = await carinaPost(
      `/api/ops/agent-engine/workspaces/${encodeURIComponent(req.params.id)}/switch`,
      { engine },
      10000,
    );
    const parsed = await carinaJson(response);
    await writeOpsAudit({
      action: 'agent_engine.workspace_switch',
      actor: actor(req),
      tenantId: req.params.id,
      details: { engine },
    });
    if (!parsed.ok) {
      res.redirect(redirect({ err: parsed.error ?? 'Switch failed' }));
      return;
    }
    res.redirect(redirect({ ok: `Workspace ${req.params.id} switched to ${engine}` }));
  } catch (err) {
    res.redirect(redirect({ err: err instanceof Error ? err.message : String(err) }));
  }
});

agentEngineRouter.post('/emergency-rollback', async (req, res) => {
  try {
    const confirm = String(req.body.confirm ?? '') === 'SWITCH_ALL_TO_CARINA';
    if (!confirm) {
      res.redirect(redirect({ err: 'Type SWITCH_ALL_TO_CARINA to confirm emergency rollback' }));
      return;
    }
    const response = await carinaPost('/api/ops/agent-engine/emergency-rollback', {}, 15000);
    const parsed = await carinaJson(response);
    await writeOpsAudit({
      action: 'agent_engine.emergency_rollback',
      actor: actor(req),
      details: { engine: 'carina' },
    });
    if (!parsed.ok) {
      res.redirect(redirect({ err: parsed.error ?? 'Rollback failed' }));
      return;
    }
    res.redirect(redirect({ ok: 'Emergency rollback: all traffic to Carina Native' }));
  } catch (err) {
    res.redirect(redirect({ err: err instanceof Error ? err.message : String(err) }));
  }
});

agentEngineRouter.post('/deploy', async (req, res) => {
  try {
    const action = String(req.body.action ?? 'restart').trim();
    const response = await carinaPost('/api/ops/agent-engine/deploy', { action }, 30000);
    const parsed = await carinaJson<{
      action?: string;
      status?: string;
      estimated_downtime_seconds?: number;
      detail?: string;
      error?: string;
    }>(response);
    await writeOpsAudit({
      action: `agent_engine.deploy_${action}`,
      actor: actor(req),
      details: parsed.data ?? {},
    });
    if (!parsed.ok || !parsed.data) {
      res.redirect(redirect({ err: parsed.error ?? 'Deploy failed' }));
      return;
    }
    const downtime = parsed.data.estimated_downtime_seconds ?? 5;
    res.redirect(redirect({
      ok: `${action} ${parsed.data.status} (est. downtime ${downtime}s)`,
    }));
  } catch (err) {
    res.redirect(redirect({ err: err instanceof Error ? err.message : String(err) }));
  }
});
