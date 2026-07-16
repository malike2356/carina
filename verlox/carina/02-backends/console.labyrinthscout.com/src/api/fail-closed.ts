import { createHash } from 'crypto';
import { Router, type IRouter, type Response } from 'express';
import { pool } from '../db.js';
import {
  getFailClosedMode,
  getUnreachablePolicy,
  listFailClosedConfigs,
  setFailClosedMode,
  type FailClosedMode,
  type UnreachableAction,
} from '../lib/fail-closed.js';
import type { RequestWithScoutAuth } from '../types/request.js';

export const failClosedRouter: IRouter = Router();

const VALID_MODES: FailClosedMode[] = ['fail_open', 'fail_closed', 'dry_run'];
const VALID_ACTIONS: UnreachableAction[] = ['block', 'allow', 'alert_only'];

function requireAccountId(req: RequestWithScoutAuth, res: Response): string | null {
  if (req.scoutAuth?.kind === 'account') return req.scoutAuth.accountId;
  const fromBody = typeof req.body?.accountId === 'string' ? req.body.accountId.trim() : '';
  const fromQuery = typeof req.query.account_id === 'string' ? req.query.account_id.trim() : '';
  if (req.scoutAuth?.kind === 'operator' && (fromBody || fromQuery)) {
    return fromBody || fromQuery;
  }
  res.status(403).json({ error: 'Account auth required (or operator with account_id)' });
  return null;
}

failClosedRouter.get('/', async (req: RequestWithScoutAuth, res: Response): Promise<void> => {
  const accountId = requireAccountId(req, res);
  if (!accountId) return;
  const configs = await listFailClosedConfigs(accountId);
  res.json({ configs });
});

failClosedRouter.post('/', async (req: RequestWithScoutAuth, res: Response): Promise<void> => {
  const accountId = requireAccountId(req, res);
  if (!accountId) return;
  const toolClass = typeof req.body?.toolClass === 'string' ? req.body.toolClass.trim() : '';
  const mode = req.body?.mode as FailClosedMode;
  const unreachableAction = req.body?.unreachableAction as UnreachableAction;
  if (!toolClass) {
    res.status(400).json({ error: 'toolClass is required' });
    return;
  }
  if (!VALID_MODES.includes(mode)) {
    res.status(400).json({ error: `mode must be one of: ${VALID_MODES.join(', ')}` });
    return;
  }
  if (!VALID_ACTIONS.includes(unreachableAction)) {
    res.status(400).json({ error: `unreachableAction must be one of: ${VALID_ACTIONS.join(', ')}` });
    return;
  }
  await setFailClosedMode(accountId, toolClass, mode, unreachableAction);
  res.json({ ok: true, toolClass, mode, unreachableAction });
});

failClosedRouter.get('/unreachable-policy', async (req: RequestWithScoutAuth, res: Response): Promise<void> => {
  const accountId = typeof req.query.account_id === 'string' ? req.query.account_id : null;
  const proxyKey = String(req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
  if (!accountId) {
    res.status(400).json({ error: 'account_id is required' });
    return;
  }
  if (proxyKey) {
    const hash = createHash('sha256').update(proxyKey).digest('hex');
    const check = await pool.query(
      `SELECT id FROM sensor_keys WHERE account_id = $1 AND key_hash = $2 AND active = true LIMIT 1`,
      [accountId, hash],
    );
    if (!check.rows[0]) {
      res.status(401).json({ error: 'Invalid sensor key' });
      return;
    }
  } else if (req.scoutAuth?.kind !== 'account' || req.scoutAuth.accountId !== accountId) {
    if (req.scoutAuth?.kind !== 'operator') {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
  }
  const policy = await getUnreachablePolicy(accountId);
  res.json(policy);
});

failClosedRouter.get('/mode', async (req: RequestWithScoutAuth, res: Response): Promise<void> => {
  const accountId = requireAccountId(req, res);
  if (!accountId) return;
  const toolClass = typeof req.query.toolClass === 'string' ? req.query.toolClass : 'protect.isolate_network';
  const config = await getFailClosedMode(accountId, toolClass);
  res.json(config);
});
