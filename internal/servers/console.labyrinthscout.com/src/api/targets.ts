import { Router, type IRouter } from 'express';
import type { Request, Response } from 'express';
import { resolveAccountId } from '../findings/account-scope.js';
import {
  createTarget,
  deactivateTarget,
  getTargetById,
  listTargets,
  queueScanRun,
} from '../findings/store.js';
import { isKnownEngine } from '../engines/registry.js';
import type { TargetType } from '../findings/types.js';

export const targetsRouter: IRouter = Router();

const VALID_TARGET_TYPES = new Set<TargetType>(['domain', 'ip', 'cidr']);

function parseTargetType(value: unknown): TargetType | null {
  return typeof value === 'string' && VALID_TARGET_TYPES.has(value as TargetType)
    ? value as TargetType
    : null;
}

targetsRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  const accountId = resolveAccountId(req, res);
  if (!accountId) return;

  try {
    const includeInactive = req.query.include_inactive === 'true';
    const targets = await listTargets(accountId, !includeInactive);
    res.json({ targets });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scout:targets] list failed:', msg);
    res.status(500).json({ error: 'Failed to list targets' });
  }
});

targetsRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  const accountId = resolveAccountId(req, res);
  if (!accountId) return;

  const body = req.body as Record<string, unknown>;
  const target = typeof body.target === 'string' ? body.target.trim() : '';
  const targetType = parseTargetType(body.target_type);
  const label = typeof body.label === 'string' ? body.label.trim() : undefined;

  if (!target || target.length > 253) {
    res.status(400).json({ error: 'target is required and must be under 253 characters' });
    return;
  }
  if (!targetType) {
    res.status(400).json({ error: 'target_type must be domain, ip, or cidr' });
    return;
  }

  try {
    const created = await createTarget({ accountId, target, targetType, label });
    res.status(201).json(created);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('unique') || msg.includes('duplicate')) {
      res.status(409).json({ error: 'Target already exists for this account' });
      return;
    }
    console.error('[scout:targets] create failed:', msg);
    res.status(500).json({ error: 'Failed to create target' });
  }
});

targetsRouter.delete('/:targetId', async (req: Request, res: Response): Promise<void> => {
  const accountId = resolveAccountId(req, res);
  if (!accountId) return;

  const targetId = typeof req.params.targetId === 'string' ? req.params.targetId : '';
  if (!targetId) {
    res.status(400).json({ error: 'targetId is required' });
    return;
  }

  try {
    const removed = await deactivateTarget(accountId, targetId);
    if (!removed) {
      res.status(404).json({ error: 'Target not found' });
      return;
    }
    res.json({ deactivated: true, targetId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scout:targets] deactivate failed:', msg);
    res.status(500).json({ error: 'Failed to deactivate target' });
  }
});

targetsRouter.post('/:targetId/scan', async (req: Request, res: Response): Promise<void> => {
  const accountId = resolveAccountId(req, res);
  if (!accountId) return;

  const targetId = typeof req.params.targetId === 'string' ? req.params.targetId : '';
  if (!targetId) {
    res.status(400).json({ error: 'targetId is required' });
    return;
  }

  const body = req.body as Record<string, unknown>;
  const tool = typeof body.tool === 'string' && body.tool.trim() ? body.tool.trim() : 'nmap';

  if (!isKnownEngine(tool)) {
    res.status(400).json({ error: `Unknown scan engine: ${tool}` });
    return;
  }

  try {
    const existing = await getTargetById(accountId, targetId);
    if (!existing) {
      res.status(404).json({ error: 'Target not found' });
      return;
    }

    const scan = await queueScanRun(accountId, targetId, tool);
    if (!scan) {
      res.status(400).json({ error: 'Target is inactive or unavailable' });
      return;
    }

    res.status(202).json(scan);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scout:targets] scan queue failed:', msg);
    res.status(500).json({ error: 'Failed to queue scan' });
  }
});
