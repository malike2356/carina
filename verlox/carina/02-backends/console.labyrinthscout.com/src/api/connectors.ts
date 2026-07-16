import { Router, type IRouter } from 'express';
import type { Request, Response } from 'express';
import { requireScoutPro } from '../middleware/plan-gate.js';
import {
  createInitializedConnector,
  listConnectorConfigs,
  setConnectorEnabled,
  updateConnectorHealth,
  upsertConnectorConfig,
} from '../lib/connector-config.js';
import { listConnectorDefinitions } from '../connectors/registry.js';
import { mapSecurityEventToFinding } from '../connectors/event-mapper.js';
import type { RequestWithScoutAuth } from '../types/request.js';

export const connectorsRouter: IRouter = Router();

function resolveAccountId(req: RequestWithScoutAuth): string | null {
  if (req.scoutAuth?.kind === 'account') {
    return req.scoutAuth.accountId;
  }
  const fromBody = typeof req.body?.account_id === 'string' ? req.body.account_id.trim() : '';
  const fromQuery = typeof req.query.account_id === 'string' ? req.query.account_id.trim() : '';
  return fromBody || fromQuery || null;
}

connectorsRouter.get('/', async (req: RequestWithScoutAuth, res: Response): Promise<void> => {
  try {
    const accountId = resolveAccountId(req);
    const available = listConnectorDefinitions();
    const configured = accountId ? await listConnectorConfigs(accountId) : [];
    res.json({ available, configured });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

connectorsRouter.post('/:id/enable', requireScoutPro, async (req: RequestWithScoutAuth, res: Response): Promise<void> => {
  const connectorId = String(req.params.id ?? '').trim();
  const accountId = resolveAccountId(req);
  if (!accountId) {
    res.status(400).json({ error: 'account_id required' });
    return;
  }

  const config =
    req.body?.config && typeof req.body.config === 'object' && !Array.isArray(req.body.config)
      ? (req.body.config as Record<string, string>)
      : {};

  try {
    const saved = await upsertConnectorConfig(accountId, connectorId, {
      enabled: true,
      config,
    });
    res.json({ ok: true, connector: saved });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: msg });
  }
});

connectorsRouter.post('/:id/disable', requireScoutPro, async (req: RequestWithScoutAuth, res: Response): Promise<void> => {
  const connectorId = String(req.params.id ?? '').trim();
  const accountId = resolveAccountId(req);
  if (!accountId) {
    res.status(400).json({ error: 'account_id required' });
    return;
  }

  try {
    await setConnectorEnabled(accountId, connectorId, false);
    res.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

connectorsRouter.get('/:id/health', requireScoutPro, async (req: RequestWithScoutAuth, res: Response): Promise<void> => {
  const connectorId = String(req.params.id ?? '').trim();
  const accountId = resolveAccountId(req);
  if (!accountId) {
    res.status(400).json({ error: 'account_id required' });
    return;
  }

  try {
    const initialized = await createInitializedConnector(accountId, connectorId);
    if (!initialized) {
      res.status(404).json({ error: 'Connector not enabled or not configured' });
      return;
    }

    const health = await initialized.connector.health();
    await updateConnectorHealth(accountId, connectorId, health.lastChecked);
    await initialized.connector.shutdown();
    res.json({ ok: health.ok, health });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

connectorsRouter.post('/:id/test', requireScoutPro, async (req: RequestWithScoutAuth, res: Response): Promise<void> => {
  const connectorId = String(req.params.id ?? '').trim();
  const accountId = resolveAccountId(req);
  if (!accountId) {
    res.status(400).json({ error: 'account_id required' });
    return;
  }

  try {
    const initialized = await createInitializedConnector(accountId, connectorId);
    if (!initialized) {
      res.status(404).json({ error: 'Connector not enabled or not configured' });
      return;
    }

    const finding = mapSecurityEventToFinding(
      {
        id: 'test-finding',
        instance_id: 'scout-test-agent',
        session_id: 'test-session',
        event_type: 'injection_blocked',
        severity: 'critical',
        description: 'Scout connector dry-run test event',
        created_at: new Date(),
        acknowledged: false,
        acknowledged_by: null,
        acknowledged_at: null,
      },
      accountId,
      { remediation: 'No action required; this is a test event.' },
    );
    finding.title = 'Connector test event';

    const result = await initialized.connector.pushFinding(finding);
    await initialized.connector.shutdown();
    res.json({ ok: result.ok, result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});
