/** Mount /api/ops/agent-engine/* (C05). */

import type { Express, Request, Response } from 'express';
import { authorizeOps } from '../ops/ops-auth.js';
import {
  deployAgentEngine,
  emergencyRollbackToCarina,
  getAgentEngineConfig,
  getAgentEngineHealth,
  getAgentEngineLogs,
  getAgentEngineMeta,
  listAgentEngineWorkspaces,
  recordKillActivation,
  switchWorkspaceEngine,
  updateAgentEngineConfig,
} from '../ops/agent-engine/service.js';

function actorFrom(req: Request): string {
  const header = req.header('x-ops-actor') || req.header('x-actor');
  return (header || 'ops-admin').trim() || 'ops-admin';
}

export function mountOpsAgentEngineRoutes(app: Express): void {
  app.get('/api/ops/agent-engine/health', async (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    try {
      const health = await getAgentEngineHealth();
      res.json(health);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get('/api/ops/agent-engine/config', (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    res.json(getAgentEngineConfig());
  });

  app.patch('/api/ops/agent-engine/config', async (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const config = await updateAgentEngineConfig(body, actorFrom(req));
      res.json(config);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get('/api/ops/agent-engine/workspaces', async (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    try {
      const payload = await listAgentEngineWorkspaces();
      res.json(payload);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post('/api/ops/agent-engine/workspaces/:id/switch', async (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    try {
      const id = String(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
      const body = (req.body ?? {}) as { engine?: string; name?: string };
      const result = await switchWorkspaceEngine(id, body.engine, actorFrom(req), body.name);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post('/api/ops/agent-engine/emergency-rollback', async (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    try {
      const result = await emergencyRollbackToCarina(actorFrom(req));
      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post('/api/ops/agent-engine/deploy', async (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    try {
      const body = (req.body ?? {}) as { action?: string };
      const result = await deployAgentEngine(body.action, actorFrom(req));
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get('/api/ops/agent-engine/logs', async (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    try {
      const level = typeof req.query.level === 'string' ? req.query.level : undefined;
      const limit = req.query.limit ? Number(req.query.limit) : 50;
      const logs = await getAgentEngineLogs(level, limit);
      res.json({ logs });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get('/api/ops/agent-engine/meta', (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    res.json(getAgentEngineMeta());
  });

  app.post('/api/ops/agent-engine/kill-notify', async (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const body = (req.body ?? {}) as { workspace_id?: string };
    const workspaceId = String(body.workspace_id ?? '').trim();
    if (!workspaceId) {
      res.status(400).json({ error: 'workspace_id is required' });
      return;
    }
    await recordKillActivation(workspaceId, actorFrom(req));
    res.json({ ok: true });
  });
}
