import { Router, type IRouter } from 'express';
import type { Request, Response } from 'express';
import { provisionCarinaTenant } from '../lib/accounts.js';

export const provisionRouter: IRouter = Router();

const LICENSE_RE = /^scout_(live|test)_[A-Za-z0-9]{24,}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

provisionRouter.post('/provision-tenant', async (req: Request, res: Response): Promise<void> => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const carinaTenantId = typeof body.carinaTenantId === 'string' ? body.carinaTenantId.trim() : '';
  const licenseKey = typeof body.licenseKey === 'string' ? body.licenseKey.trim() : '';
  const plan =
    body.plan === 'scout_monitor' ||
    body.plan === 'scout_pro' ||
    body.plan === 'scout_standard' ||
    body.plan === 'enterprise'
      ? body.plan
      : 'scout_pro';

  if (!EMAIL_RE.test(email)) {
    res.status(400).json({ error: 'A valid email is required' });
    return;
  }
  if (!carinaTenantId || !/^[0-9a-f-]{36}$/i.test(carinaTenantId)) {
    res.status(400).json({ error: 'carinaTenantId must be a UUID' });
    return;
  }
  if (!LICENSE_RE.test(licenseKey)) {
    res.status(400).json({ error: 'licenseKey must be a scout_live_* or scout_test_* key' });
    return;
  }

  try {
    const result = await provisionCarinaTenant({ email, carinaTenantId, licenseKey });
    res.status(result.created ? 201 : 200).json({
      accountId: result.accountId,
      created: result.created,
      setupToken: result.setupToken,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scout:provision] failed:', msg);
    res.status(500).json({ error: 'Provisioning failed' });
  }
});

provisionRouter.post('/sync-plan', async (req: Request, res: Response): Promise<void> => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const carinaTenantId = typeof body.carinaTenantId === 'string' ? body.carinaTenantId.trim() : '';
  const plan =
    body.plan === 'scout_monitor' ||
    body.plan === 'scout_pro' ||
    body.plan === 'scout_standard' ||
    body.plan === 'enterprise'
      ? body.plan
      : null;

  if (!carinaTenantId || !/^[0-9a-f-]{36}$/i.test(carinaTenantId)) {
    res.status(400).json({ error: 'carinaTenantId must be a UUID' });
    return;
  }
  if (!plan) {
    res.status(400).json({ error: 'plan must be scout_monitor, scout_pro, or enterprise' });
    return;
  }

  const { setSubscriptionPlanByCarinaTenant } = await import('../lib/subscription-plan.js');
  const updated = await setSubscriptionPlanByCarinaTenant(carinaTenantId, plan);
  if (!updated) {
    res.status(404).json({ error: 'Account not found for tenant' });
    return;
  }
  res.json({ ok: true, plan });
});
