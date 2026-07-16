import { Router } from 'express';
import {
  BILLING_CONFIG_GROUP_LABELS,
  bulkUpsertBillingConfig,
  groupRows,
  isUnchangedSecretSubmission,
  listBillingConfig,
  parseCredentialBundle,
  upsertBillingConfig,
} from '../lib/billing-config-store.js';
import { notifyCoreBillingConfigReload } from '../lib/billing-config-notify.js';

export const billingConfigRouter = Router();

const VALID_GROUPS = new Set(Object.keys(BILLING_CONFIG_GROUP_LABELS));

function resolveGroup(raw: unknown): string {
  const group = String(raw ?? '').trim();
  return VALID_GROUPS.has(group) ? group : '';
}

function billingConfigRedirect(query: Record<string, string>, group?: string): string {
  const params = new URLSearchParams(query);
  const g = resolveGroup(group);
  if (g) params.set('group', g);
  const qs = params.toString();
  return qs ? `/billing-config?${qs}` : '/billing-config';
}

billingConfigRouter.get('/', async (req, res) => {
  const rows = await listBillingConfig();
  const group = resolveGroup(req.query['group']);
  res.render('billing-config', {
    title: 'Billing and launch config',
    rows,
    grouped: groupRows(rows),
    groupLabels: BILLING_CONFIG_GROUP_LABELS,
    group,
    saved: req.query['saved'] === '1',
    cleared: req.query['cleared'] === '1',
    reloadWarn: req.query['reload_warn'] === '1',
    bulkSaved: typeof req.query['bulk_saved'] === 'string' ? req.query['bulk_saved'] : '',
    bulkSkipped: typeof req.query['bulk_skipped'] === 'string' ? req.query['bulk_skipped'] : '',
    errMsg: typeof req.query['err'] === 'string' ? req.query['err'] : '',
  });
});

billingConfigRouter.post('/update', async (req, res) => {
  const { key, value, group } = req.body as { key?: string; value?: string; group?: string };
  const configKey = (key ?? '').trim();
  const activeGroup = resolveGroup(group);
  if (!configKey) {
    res.redirect(billingConfigRedirect({ err: 'Missing config key' }, activeGroup));
    return;
  }

  const raw = String(value ?? '').trim();
  const updatedBy = req.session?.userName ?? req.session?.userId ?? 'ops-admin';

  try {
    const rows = await listBillingConfig();
    const slot = rows.find((row) => row.key === configKey);
    if (
      slot?.valueKind === 'secret'
      && slot.effectiveValue
      && isUnchangedSecretSubmission(raw, slot.effectiveValue)
    ) {
      res.redirect(billingConfigRedirect({ saved: '1' }, activeGroup || slot.group));
      return;
    }

    await upsertBillingConfig(configKey, raw, updatedBy);
    const reload = await notifyCoreBillingConfigReload();
    const query: Record<string, string> = raw ? { saved: '1' } : { cleared: '1' };
    if (!reload.ok) query.reload_warn = '1';
    res.redirect(billingConfigRedirect(query, activeGroup || slot?.group));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.redirect(billingConfigRedirect({ err: 'Save failed: ' + msg }, activeGroup));
  }
});

billingConfigRouter.post('/bulk', async (req, res) => {
  const body = req.body as { bundle?: string; group?: string };
  const bundle = String(body.bundle ?? '');
  const activeGroup = resolveGroup(body.group);
  const updatedBy = req.session?.userName ?? req.session?.userId ?? 'ops-admin';
  const entries = parseCredentialBundle(bundle);
  if (!entries.length) {
    res.redirect(billingConfigRedirect({ err: 'No recognized keys in paste block' }, activeGroup));
    return;
  }

  try {
    const result = await bulkUpsertBillingConfig(entries, updatedBy);
    const reload = await notifyCoreBillingConfigReload();
    const query: Record<string, string> = { bulk_saved: String(result.saved.length) };
    if (result.skipped.length) query.bulk_skipped = String(result.skipped.length);
    if (!reload.ok) query.reload_warn = '1';
    res.redirect(billingConfigRedirect(query, activeGroup));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.redirect(billingConfigRedirect({ err: 'Bulk save failed: ' + msg }, activeGroup));
  }
});
