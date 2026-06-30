import { Router } from 'express';
import {
  BILLING_CONFIG_GROUP_LABELS,
  groupRows,
  listBillingConfig,
  upsertBillingConfig,
} from '../lib/billing-config-store.js';

export const billingConfigRouter = Router();

billingConfigRouter.get('/', async (req, res) => {
  const rows = await listBillingConfig();
  res.render('billing-config', {
    title: 'Stripe Billing Config',
    rows,
    grouped: groupRows(rows),
    groupLabels: BILLING_CONFIG_GROUP_LABELS,
    saved: req.query['saved'] === '1',
    cleared: req.query['cleared'] === '1',
    errMsg: typeof req.query['err'] === 'string' ? req.query['err'] : '',
  });
});

billingConfigRouter.post('/update', async (req, res) => {
  const { key, value } = req.body as { key?: string; value?: string };
  const configKey = (key ?? '').trim();
  if (!configKey) {
    res.redirect('/billing-config?err=' + encodeURIComponent('Missing config key'));
    return;
  }

  const raw = String(value ?? '').trim();
  const updatedBy = req.session?.userName ?? req.session?.userId ?? 'ops-admin';

  try {
    await upsertBillingConfig(configKey, raw, updatedBy);
    const query = raw ? 'saved=1' : 'cleared=1';
    res.redirect('/billing-config?' + query);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.redirect('/billing-config?err=' + encodeURIComponent('Save failed: ' + msg));
  }
});
