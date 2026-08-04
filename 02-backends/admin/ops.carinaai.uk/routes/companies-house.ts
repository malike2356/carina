import { Router } from 'express';
import {
  carinaJson,
  carinaOpsTokenSet,
  carinaPost,
} from '../lib/carina.js';
import { hrefWithUiVersion } from '../lib/callback-url.js';
import {
  applyCompaniesHouseKey,
  fetchCompaniesHouseStatus,
  type CompaniesHouseStatus,
} from '../lib/companies-house-apply.js';

export const companiesHouseRouter = Router();

const uiVersion = process.env.UI_VERSION ?? '20260804a';
const SECRET_MASK = '••••••••••••••••';

function redirect(query: Record<string, string>): string {
  const params = new URLSearchParams(query);
  return hrefWithUiVersion(`/companies-house?${params.toString()}`, uiVersion);
}

function isUnchangedSecret(submitted: string): boolean {
  const next = submitted.trim();
  if (!next) return true;
  if (next === SECRET_MASK) return true;
  if (/^[•*]{8,}$/.test(next)) return true;
  return false;
}

companiesHouseRouter.get('/', async (req, res) => {
  let status: CompaniesHouseStatus = {
    configured: false,
    keyPresent: false,
    source: 'none',
  };

  if (carinaOpsTokenSet()) {
    try {
      status = await fetchCompaniesHouseStatus();
    } catch (err) {
      status.error = err instanceof Error ? err.message : String(err);
    }
  } else {
    status.error = 'Pair Carina in Settings first (CARINA_OPS_TOKEN).';
  }

  res.render('companies-house', {
    title: 'Companies House',
    status,
    secretDisplay: status.keyPresent ? SECRET_MASK : '',
    saved: req.query['saved'] === '1',
    tested: req.query['tested'] === '1',
    testMsg: typeof req.query['test_msg'] === 'string' ? req.query['test_msg'] : '',
    granted: typeof req.query['granted'] === 'string' ? req.query['granted'] : '',
    restarted: req.query['restarted'] === '1',
    errMsg: typeof req.query['err'] === 'string' ? req.query['err'] : '',
  });
});

companiesHouseRouter.post('/save', async (req, res) => {
  if (!carinaOpsTokenSet()) {
    res.redirect(redirect({ err: 'Pair Carina in Settings first' }));
    return;
  }

  const body = req.body as { apiKey?: string; doRestart?: string };
  const submitted = String(body.apiKey ?? '').trim();
  if (isUnchangedSecret(submitted)) {
    res.redirect(redirect({ err: 'Enter a new Companies House API key (or leave mask only when rotating)' }));
    return;
  }
  if (submitted.length < 8) {
    res.redirect(redirect({ err: 'API key looks too short' }));
    return;
  }

  try {
    const result = await applyCompaniesHouseKey({
      apiKey: submitted,
      restartServices: body.doRestart === '1',
    });
    if (!result.ok) {
      res.redirect(redirect({ err: result.error ?? 'Save failed' }));
      return;
    }
    const query: Record<string, string> = { saved: '1' };
    if (result.restarted) query.restarted = '1';
    res.redirect(redirect(query));
  } catch (err) {
    res.redirect(redirect({ err: err instanceof Error ? err.message : String(err) }));
  }
});

companiesHouseRouter.post('/test', async (req, res) => {
  if (!carinaOpsTokenSet()) {
    res.redirect(redirect({ err: 'Pair Carina in Settings first' }));
    return;
  }
  try {
    const response = await carinaPost(
      '/api/internal/settings/integration:companies-house/test',
      {},
      15000,
    );
    const parsed = await carinaJson<{ success?: boolean; message?: string }>(response);
    if (!parsed.ok) {
      res.redirect(redirect({ err: parsed.error ?? 'Test failed' }));
      return;
    }
    const msg = String(parsed.data?.message ?? (parsed.data?.success ? 'OK' : 'Failed')).slice(0, 180);
    if (parsed.data?.success === false) {
      res.redirect(redirect({ err: msg }));
      return;
    }
    res.redirect(redirect({ tested: '1', test_msg: msg }));
  } catch (err) {
    res.redirect(redirect({ err: err instanceof Error ? err.message : String(err) }));
  }
});

companiesHouseRouter.post('/grant-all', async (req, res) => {
  if (!carinaOpsTokenSet()) {
    res.redirect(redirect({ err: 'Pair Carina in Settings first' }));
    return;
  }
  try {
    const response = await carinaPost('/api/ops/companies-house/grant-all', {}, 30000);
    const parsed = await carinaJson<{ ok?: boolean; granted?: number; error?: string }>(response);
    if (!parsed.ok || !parsed.data?.ok) {
      res.redirect(redirect({ err: parsed.data?.error ?? parsed.error ?? 'Grant failed' }));
      return;
    }
    res.redirect(redirect({ granted: String(parsed.data.granted ?? 0) }));
  } catch (err) {
    res.redirect(redirect({ err: err instanceof Error ? err.message : String(err) }));
  }
});
