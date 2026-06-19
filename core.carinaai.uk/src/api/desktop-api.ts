import type { Express, Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { checkMonthlyBudget } from '../brain/cost-tracker.js';
import { BILLING_PLANS } from '../billing/plans.js';
import { listCommitments, updateCommitment } from '../commitments/store.js';
import { config } from '../config/index.js';
import { CARINA_HOME } from '../config/paths.js';
import { getKillSwitchStatus, isSuspended } from '../security/kill-switch-listener.js';
import { buildSecurityTrustState } from '../security/trust-state.js';
import type { SecurityAuditCategory } from '../security/security-audit.js';
import { getLearningLoopMetrics, listLearnedPreferences } from '../skills/learning-ops.js';
import { buildTelemetryHealthSnapshot } from '../ops/observability/health-snapshot.js';
import { readTurnLogs } from '../telemetry/turn-log.js';
import { listSubagentMetrics } from '../telemetry/subagent-metrics.js';

type DesktopWorkspace = {
  id: string;
  name: string;
  color: string;
  icon: string;
  sessionIds: string[];
  createdAt: string;
};

type WorkspaceStore = {
  workspaces: DesktopWorkspace[];
  activeId: string;
};

const WORKSPACE_FILE = path.join(CARINA_HOME, 'desktop-workspaces.json');

function defaultWorkspaceStore(): WorkspaceStore {
  const now = new Date().toISOString();
  const defaultWorkspace: DesktopWorkspace = {
    id: 'default',
    name: 'Default',
    color: '#6366f1',
    icon: 'C',
    sessionIds: [],
    createdAt: now,
  };
  return { workspaces: [defaultWorkspace], activeId: defaultWorkspace.id };
}

function loadWorkspaceStore(): WorkspaceStore {
  try {
    if (!fs.existsSync(WORKSPACE_FILE)) return defaultWorkspaceStore();
    const parsed = JSON.parse(fs.readFileSync(WORKSPACE_FILE, 'utf8')) as WorkspaceStore;
    if (!parsed.workspaces?.length) return defaultWorkspaceStore();
    return {
      workspaces: parsed.workspaces,
      activeId: parsed.activeId || parsed.workspaces[0].id,
    };
  } catch {
    return defaultWorkspaceStore();
  }
}

function saveWorkspaceStore(store: WorkspaceStore): void {
  fs.mkdirSync(CARINA_HOME, { recursive: true });
  fs.writeFileSync(WORKSPACE_FILE, JSON.stringify(store, null, 2), { mode: 0o600 });
}

function computeTrustScore(state: Awaited<ReturnType<typeof buildSecurityTrustState>>): number {
  let score = 100;
  if (state.suspended) score = 15;
  if (state.labyrinthEnabled && !state.enforcement.remoteScoutPolicy) score -= 18;
  if (!state.labyrinthEnabled) score -= 8;
  const recentIssues = state.recentSecurityAudit.filter((event) =>
    event.category === 'prompt_injection' || event.category === 'kill_switch',
  ).length;
  score -= Math.min(recentIssues * 6, 30);
  if (state.toolPolicy.allowlistEnforced) score += 5;
  return Math.max(0, Math.min(100, score));
}

function mapSeverity(category: SecurityAuditCategory): 'info' | 'warning' | 'critical' {
  if (category === 'kill_switch' || category === 'prompt_injection') return 'critical';
  if (category === 'tool_policy' || category === 'sandbox_policy' || category === 'scout_policy') {
    return 'warning';
  }
  return 'info';
}

export function mountDesktopApiRoutes(app: Express): void {
  app.get('/api/security/trust-score', async (_req: Request, res: Response) => {
    try {
      const state = await buildSecurityTrustState();
      res.json({
        score: computeTrustScore(state),
        generatedAt: state.generatedAt,
        scoutConnected: state.enforcement.remoteScoutPolicy,
        scoutUrl: config.labyrinth.enabled ? config.labyrinth.url : null,
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get('/api/security/events', async (req: Request, res: Response) => {
    try {
      const limit = Math.min(Number(req.query.limit ?? 5), 50);
      const state = await buildSecurityTrustState();
      const events = state.recentSecurityAudit.slice(-limit).reverse().map((event) => ({
        id: `${event.at}-${event.action}`,
        severity: mapSeverity(event.category),
        summary: event.detail || event.action,
        category: event.category,
        at: event.at,
      }));
      res.json({ events });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get('/api/security/kill-switch-status', (_req: Request, res: Response) => {
    const status = getKillSwitchStatus();
    res.json({
      active: status.active,
      reason: status.reason,
      triggeredAt: status.active ? new Date().toISOString() : null,
    });
  });

  app.get('/api/billing/plan', (_req: Request, res: Response) => {
    const plan = BILLING_PLANS.free;
    res.json({
      id: plan.id,
      name: plan.name,
      tokenLimit: plan.tokenLimit,
      includedCredits: plan.includedCredits,
      monthlyPriceGbp: plan.monthlyPriceGbp,
    });
  });

  app.get('/api/billing/usage', async (_req: Request, res: Response) => {
    try {
      const budget = await checkMonthlyBudget();
      const plan = BILLING_PLANS.free;
      const tokenLimit = plan.tokenLimit ?? 100_000;
      const tokensUsed = Math.round(budget.totalCost * 1000);
      res.json({
        periodStart: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
        periodEnd: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString(),
        tokensUsed,
        tokenLimit,
        messagesSent: tokensUsed > 0 ? Math.max(1, Math.round(tokensUsed / 800)) : 0,
        creditsRemaining: plan.includedCredits ?? 0,
        estimatedCostUsd: budget.totalCost,
        budgetStatus: budget.status,
      });
    } catch {
      res.json({
        periodStart: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
        periodEnd: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString(),
        tokensUsed: 0,
        tokenLimit: 100_000,
        messagesSent: 0,
        creditsRemaining: 50_000,
        estimatedCostUsd: 0,
        budgetStatus: 'ok',
      });
    }
  });

  app.get('/api/billing/sessions', async (req: Request, res: Response) => {
    try {
      const limit = Math.min(Number(req.query.limit ?? 5), 20);
      const turns = await readTurnLogs({ limit: 100 });
      const grouped = new Map<string, { sessionId: string; tokens: number; cost: number; model: string }>();
      for (const turn of turns) {
        const row = grouped.get(turn.sessionId) ?? {
          sessionId: turn.sessionId,
          tokens: 0,
          cost: 0,
          model: turn.model || turn.provider,
        };
        row.tokens += turn.responseLength ?? 0;
        row.cost += (turn.responseLength ?? 0) * 0.000002;
        grouped.set(turn.sessionId, row);
      }
      const sessions = [...grouped.values()]
        .sort((a, b) => b.tokens - a.tokens)
        .slice(0, limit)
        .map((row) => ({
          sessionId: row.sessionId,
          title: row.sessionId.slice(0, 12),
          model: row.model,
          tokens: row.tokens,
          estimatedCostUsd: row.cost,
        }));
      res.json({ sessions });
    } catch {
      res.json({ sessions: [] });
    }
  });

  app.get('/api/workspaces', (_req: Request, res: Response) => {
    const store = loadWorkspaceStore();
    res.json({
      workspaces: store.workspaces.map((workspace) => ({
        ...workspace,
        sessionCount: workspace.sessionIds.length,
      })),
      activeId: store.activeId,
    });
  });

  app.post('/api/workspaces', (req: Request, res: Response) => {
    const name = String(req.body?.name ?? '').trim();
    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }
    const store = loadWorkspaceStore();
    const workspace: DesktopWorkspace = {
      id: `ws_${Date.now().toString(36)}`,
      name,
      color: String(req.body?.color ?? '#6366f1'),
      icon: String(req.body?.icon ?? name.slice(0, 1).toUpperCase()),
      sessionIds: [],
      createdAt: new Date().toISOString(),
    };
    store.workspaces.push(workspace);
    saveWorkspaceStore(store);
    res.json({ workspace: { ...workspace, sessionCount: 0 } });
  });

  app.put('/api/workspaces/active', (req: Request, res: Response) => {
    const id = String(req.body?.id ?? '').trim();
    const store = loadWorkspaceStore();
    if (!store.workspaces.some((workspace) => workspace.id === id)) {
      res.status(404).json({ error: 'workspace not found' });
      return;
    }
    store.activeId = id;
    saveWorkspaceStore(store);
    res.json({ activeId: id });
  });

  app.delete('/api/workspaces/:id', (req: Request, res: Response) => {
    const id = String(req.params.id ?? '');
    const store = loadWorkspaceStore();
    if (id === 'default') {
      res.status(400).json({ error: 'cannot delete default workspace' });
      return;
    }
    const target = store.workspaces.find((workspace) => workspace.id === id);
    if (!target) {
      res.status(404).json({ error: 'workspace not found' });
      return;
    }
    const defaultWorkspace = store.workspaces.find((workspace) => workspace.id === 'default');
    if (defaultWorkspace) {
      defaultWorkspace.sessionIds.push(...target.sessionIds);
    }
    store.workspaces = store.workspaces.filter((workspace) => workspace.id !== id);
    if (store.activeId === id) store.activeId = 'default';
    saveWorkspaceStore(store);
    res.json({ ok: true });
  });

  app.get('/api/commitments', (req: Request, res: Response) => {
    const status = typeof req.query.status === 'string' ? req.query.status : 'all';
    const commitments = listCommitments({
      status: status as 'all' | 'pending' | 'sent' | 'dismissed' | 'snoozed' | 'expired',
    }).map((item) => ({
      id: item.id,
      status: item.status === 'sent' ? 'completed' : item.status === 'pending' ? 'in-progress' : item.status,
      title: item.checkInText,
      dueAt: item.dueAt,
      sessionId: item.sessionId,
      kind: item.kind,
      sourceSummary: item.sourceSummary,
    }));
    res.json({ commitments });
  });

  app.post('/api/commitments/:id/complete', (req: Request, res: Response) => {
    const id = String(req.params.id ?? '');
    const updated = updateCommitment(id, { status: 'sent', sentAt: new Date().toISOString() });
    if (!updated) {
      res.status(404).json({ error: 'commitment not found' });
      return;
    }
    res.json({ ok: true });
  });

  app.post('/api/commitments/:id/cancel', (req: Request, res: Response) => {
    const id = String(req.params.id ?? '');
    const updated = updateCommitment(id, { status: 'dismissed', dismissedAt: new Date().toISOString() });
    if (!updated) {
      res.status(404).json({ error: 'commitment not found' });
      return;
    }
    res.json({ ok: true });
  });

  app.get('/api/metrics/learning', async (_req: Request, res: Response) => {
    try {
      const tenantId = process.env.CARINA_TENANT_ID ?? '__operator__';
      const metrics = await getLearningLoopMetrics(tenantId);
      const preferences = await listLearnedPreferences(tenantId, 20);
      res.json({
        skillSuccessRate: metrics.promotionsLast7d > 0 ? 0.85 : 0,
        memoriesExtractedWeekly: metrics.eventsLast24h,
        preferences,
        selfImprovementSkills: [],
      });
    } catch {
      res.json({
        skillSuccessRate: 0,
        memoriesExtractedWeekly: 0,
        preferences: [],
        selfImprovementSkills: [],
      });
    }
  });

  app.get('/api/system/health', async (_req: Request, res: Response) => {
    try {
      const snapshot = await buildTelemetryHealthSnapshot();
      res.json({
        uptimeSeconds: process.uptime(),
        gatewayStatus: 'ok',
        heapUsedMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        queueDepth: listSubagentMetrics(50).filter((row) => row.status === 'started').length,
        suspended: isSuspended(),
        snapshot,
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get('/api/benchmarks', async (_req: Request, res: Response) => {
    res.json({
      runs: [],
      metrics: {
        taskSuccessRate: 0,
        avgResponseMs: 0,
        toolCallEfficiency: 0,
      },
    });
  });

  app.post('/api/benchmarks/run', (_req: Request, res: Response) => {
    res.status(501).json({ error: 'Benchmark runner not configured on this gateway' });
  });

  app.get('/api/orchestration/active', (_req: Request, res: Response) => {
    const agents = listSubagentMetrics(20).map((row) => ({
      id: `${row.sessionId}-${row.ts}`,
      name: row.agentType || 'subagent',
      status: row.status === 'started' ? 'running' : row.status,
      task: row.errorClass ? `Error: ${row.errorClass}` : 'Running task',
      startedAt: row.ts,
      parentSessionId: row.sessionId,
    }));
    res.json({ agents });
  });
}
