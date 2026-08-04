import { Router, type Request, type Router as ExpressRouter } from 'express';
import { pool } from '../memory/db.js';
import { dismissGapProposal, listGapProposals } from '../mutation/gap-detector.js';
import { promptOverrideStore } from '../mutation/prompt-override-store.js';
import { runFullPrune } from '../mutation/pruner.js';
import { computeCompoundingMetrics } from '../mutation/compounding.js';
import {
  requestExtension, approveExtension, rejectExtension,
} from '../mutation/extension-harness.js';

export const mutationApiRouter: ExpressRouter = Router();

function resolveTenantId(req: Request): string {
  return (req.header('x-carina-tenant-id') ?? process.env.CARINA_TENANT_ID ?? '__operator__').trim();
}

mutationApiRouter.get('/gaps', async (req, res) => {
  try {
    const proposals = await listGapProposals({
      tenantId: resolveTenantId(req),
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
      limit: Number(req.query.limit ?? 50),
    });
    res.json({ proposals });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

mutationApiRouter.post('/gaps/:id/dismiss', async (req, res) => {
  try {
    await dismissGapProposal(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

mutationApiRouter.get('/prompts/history', async (req, res) => {
  try {
    const history = await promptOverrideStore.getHistory(
      resolveTenantId(req),
      Number(req.query.limit ?? 20),
    );
    res.json({ history });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

mutationApiRouter.get('/prompts/staged', async (req, res) => {
  try {
    const staged = await promptOverrideStore.listStaged(resolveTenantId(req));
    res.json({ staged });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

mutationApiRouter.post('/prompts/:id/activate', async (req, res) => {
  try {
    const record = await promptOverrideStore.activate(req.params.id, 'operator');
    res.json({ success: true, record });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

mutationApiRouter.post('/prompts/rollback', async (req, res) => {
  try {
    const restored = await promptOverrideStore.rollback(resolveTenantId(req), 'operator');
    if (!restored) {
      res.status(404).json({ error: 'No previous version to restore' });
      return;
    }
    res.json({ success: true, restored });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

mutationApiRouter.get('/compounding', async (req, res) => {
  try {
    const metrics = await computeCompoundingMetrics(resolveTenantId(req));
    res.json(metrics);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

mutationApiRouter.post('/prune/dry-run', async (_req, res) => {
  try {
    const report = await runFullPrune(true);
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

mutationApiRouter.post('/prune', async (_req, res) => {
  try {
    const report = await runFullPrune(false);
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

mutationApiRouter.post('/extensions/request', async (req, res) => {
  if (process.env.CARINA_MUTATION_EXTENSIONS !== 'true') {
    res.status(403).json({ error: 'CARINA_MUTATION_EXTENSIONS is not enabled' });
    return;
  }
  try {
    const { task, runTests } = req.body as { task: string; runTests?: boolean };
    if (!task?.trim()) {
      res.status(400).json({ error: 'task is required' });
      return;
    }
    const result = await requestExtension({
      task,
      tenantId: resolveTenantId(req),
      requestedBy: 'operator',
      runTests,
    });
    res.status(result.success ? 202 : 422).json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

mutationApiRouter.get('/extensions', async (req, res) => {
  try {
    const status = req.query.status as string | undefined;
    const conditions = ['tenant_id = $1'];
    const values: unknown[] = [resolveTenantId(req)];
    if (status) {
      conditions.push(`status = $2`);
      values.push(status);
    }
    const result = await pool.query(
      `SELECT * FROM extension_mutations WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC LIMIT 50`,
      values,
    );
    res.json({ extensions: result.rows });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

mutationApiRouter.post('/extensions/:id/approve', async (req, res) => {
  try {
    await approveExtension(req.params.id, 'operator');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

mutationApiRouter.post('/extensions/:id/reject', async (req, res) => {
  try {
    await rejectExtension(req.params.id, 'operator');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});
