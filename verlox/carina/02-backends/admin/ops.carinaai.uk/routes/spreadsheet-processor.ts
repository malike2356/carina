import { Router } from 'express';
import {
  listBillingConfig,
  maskSecretValue,
  upsertBillingConfig,
  isUnchangedSecretSubmission,
} from '../lib/billing-config-store.js';

export const spreadsheetProcessorRouter = Router();

const SP_KEYS = [
  'SP_IMAP_HOST',
  'SP_IMAP_PORT',
  'SP_IMAP_USER',
  'SP_IMAP_PASSWORD',
  'SP_DEEPSEEK_API_KEY',
  'SP_POLL_INTERVAL',
  'SYSTEM_EMAIL_FROM',
];

async function loadSpConfig(): Promise<Record<string, string>> {
  const rows = await listBillingConfig();
  const cfg: Record<string, string> = {};
  for (const r of rows) {
    if (SP_KEYS.includes(r.key)) {
      cfg[r.key] = r.effectiveValue ?? '';
    }
  }
  return cfg;
}

spreadsheetProcessorRouter.get('/', async (_req, res) => {
  try {
    const cfg = await loadSpConfig();
    res.render('spreadsheet-processor', {
      title: 'Spreadsheet Processor',
      cfg,
      maskedImapPwd: cfg['SP_IMAP_PASSWORD'] ? maskSecretValue(cfg['SP_IMAP_PASSWORD']) : '',
      maskedDeepseek: cfg['SP_DEEPSEEK_API_KEY'] ? maskSecretValue(cfg['SP_DEEPSEEK_API_KEY']) : '',
      saved: false,
      deployed: false,
      errMsg: '',
    });
  } catch (err) {
    res.render('spreadsheet-processor', {
      title: 'Spreadsheet Processor',
      cfg: {},
      maskedImapPwd: '',
      maskedDeepseek: '',
      saved: false,
      deployed: false,
      errMsg: err instanceof Error ? err.message : 'Failed to load config',
    });
  }
});

spreadsheetProcessorRouter.post('/save', async (req, res) => {
  try {
    const body = req.body as Record<string, string>;
    const cfg = await loadSpConfig();
    const operator = (req.session as { email?: string }).email ?? 'ops';

    const pairs: Array<{ key: string; value: string }> = [
      { key: 'SP_IMAP_HOST', value: body.imapHost?.trim() || 'imap.gmail.com' },
      { key: 'SP_IMAP_PORT', value: body.imapPort?.trim() || '993' },
      { key: 'SP_IMAP_USER', value: body.imapUser?.trim() || '' },
      { key: 'SP_POLL_INTERVAL', value: body.pollInterval?.trim() || '120' },
    ];

    if (body.imapPassword && !isUnchangedSecretSubmission(body.imapPassword, cfg['SP_IMAP_PASSWORD'] || '')) {
      pairs.push({ key: 'SP_IMAP_PASSWORD', value: body.imapPassword.trim() });
    }
    if (body.deepseekKey && !isUnchangedSecretSubmission(body.deepseekKey, cfg['SP_DEEPSEEK_API_KEY'] || '')) {
      pairs.push({ key: 'SP_DEEPSEEK_API_KEY', value: body.deepseekKey.trim() });
    }

    for (const { key, value } of pairs) {
      await upsertBillingConfig(key, value, operator);
    }

    res.render('spreadsheet-processor', {
      title: 'Spreadsheet Processor',
      cfg: await loadSpConfig(),
      maskedImapPwd: maskSecretValue((await loadSpConfig())['SP_IMAP_PASSWORD'] || ''),
      maskedDeepseek: maskSecretValue((await loadSpConfig())['SP_DEEPSEEK_API_KEY'] || ''),
      saved: true,
      deployed: body.deployEnv === '1',
      errMsg: '',
    });
  } catch (err) {
    const cfg = await loadSpConfig().catch(() => ({} as Record<string, string>));
    res.render('spreadsheet-processor', {
      title: 'Spreadsheet Processor',
      cfg,
      maskedImapPwd: '',
      maskedDeepseek: '',
      saved: false,
      deployed: false,
      errMsg: err instanceof Error ? err.message : 'Save failed',
    });
  }
});
