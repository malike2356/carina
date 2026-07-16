import { Router } from 'express';
import {
  listBillingConfig,
  upsertBillingConfig,
  type BillingConfigRow,
} from '../lib/billing-config-store.js';
import { notifyCoreBillingConfigReload } from '../lib/billing-config-notify.js';

export const usageGatesRouter = Router();

const USAGE_GATE_KEYS = [
  'AIVA_TRIAL_MESSAGE_LIMIT',
  'AIVA_TRIAL_CREDIT_GBP',
  'AIVA_TRIAL_DAILY_CAP_GBP',
  'AIVA_SOFT_WALL_ALLOW_BYOK',
  'AIVA_SOFT_WALL_ALLOW_TOPUP',
  'AIVA_SOFT_WALL_ALLOW_UPGRADE',
  'AIVA_SOFT_WALL_ALLOW_MINI_LLM',
  'CARINA_CLOUD_FREE_DAILY_MESSAGES',
  'CARINA_CLOUD_FREE_DAILY_TOKENS',
] as const;

type GateKey = (typeof USAGE_GATE_KEYS)[number];

function rowMap(rows: BillingConfigRow[]): Record<string, BillingConfigRow> {
  return Object.fromEntries(rows.map((row) => [row.key, row]));
}

usageGatesRouter.get('/', async (req, res) => {
  const rows = rowMap(await listBillingConfig());
  res.render('usage-gates', {
    title: 'Free usage gates',
    rows,
    saved: req.query['saved'] === '1',
    reloadWarn: req.query['reload_warn'] === '1',
    errMsg: typeof req.query['err'] === 'string' ? req.query['err'] : '',
  });
});

usageGatesRouter.post('/save', async (req, res) => {
  const body = req.body as Record<string, string>;
  const updatedBy = req.session?.userName ?? req.session?.userId ?? 'ops-admin';
  try {
    const values: Record<GateKey, string> = {
      AIVA_TRIAL_MESSAGE_LIMIT: String(body.AIVA_TRIAL_MESSAGE_LIMIT ?? '').trim() || '20',
      AIVA_TRIAL_CREDIT_GBP: String(body.AIVA_TRIAL_CREDIT_GBP ?? '').trim() || '1',
      AIVA_TRIAL_DAILY_CAP_GBP: String(body.AIVA_TRIAL_DAILY_CAP_GBP ?? '').trim() || '2',
      AIVA_SOFT_WALL_ALLOW_BYOK: body.AIVA_SOFT_WALL_ALLOW_BYOK === 'on' ? 'on' : 'off',
      AIVA_SOFT_WALL_ALLOW_TOPUP: body.AIVA_SOFT_WALL_ALLOW_TOPUP === 'on' ? 'on' : 'off',
      AIVA_SOFT_WALL_ALLOW_UPGRADE: body.AIVA_SOFT_WALL_ALLOW_UPGRADE === 'on' ? 'on' : 'off',
      AIVA_SOFT_WALL_ALLOW_MINI_LLM: body.AIVA_SOFT_WALL_ALLOW_MINI_LLM === 'on' ? 'on' : 'off',
      CARINA_CLOUD_FREE_DAILY_MESSAGES:
        String(body.CARINA_CLOUD_FREE_DAILY_MESSAGES ?? '').trim() || '100',
      CARINA_CLOUD_FREE_DAILY_TOKENS:
        String(body.CARINA_CLOUD_FREE_DAILY_TOKENS ?? '').trim() || '50000',
    };

    for (const key of USAGE_GATE_KEYS) {
      await upsertBillingConfig(key, values[key], updatedBy);
    }

    const reload = await notifyCoreBillingConfigReload();
    const query = reload.ok ? '?saved=1' : '?saved=1&reload_warn=1';
    res.redirect(`/usage-gates${query}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.redirect(`/usage-gates?err=${encodeURIComponent(msg)}`);
  }
});
