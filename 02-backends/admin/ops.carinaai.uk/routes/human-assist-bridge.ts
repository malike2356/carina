import { Router } from 'express';
import {
  fetchHumanAssistBridgeStatus,
  saveHumanAssistBridge,
} from '../lib/human-assist-bridge.js';
import { carinaOpsTokenSet } from '../lib/carina.js';
import { hrefWithUiVersion } from '../lib/callback-url.js';

export const humanAssistBridgeRouter = Router();

const uiVersion = process.env.UI_VERSION ?? '20260714c';

function redirectTo(query: Record<string, string>): string {
  const params = new URLSearchParams(query);
  return hrefWithUiVersion(`/human-assist-bridge?${params.toString()}`, uiVersion);
}

humanAssistBridgeRouter.get('/', async (req, res) => {
  let status = {
    enabled: false,
    misBaseUrl: 'https://verlox.uk',
    bridgeTokenSet: false,
    publishMode: 'push_and_poll',
    error: undefined as string | undefined,
  };

  if (carinaOpsTokenSet()) {
    try {
      status = { ...status, ...(await fetchHumanAssistBridgeStatus()) };
    } catch (err) {
      status.error = err instanceof Error ? err.message : String(err);
    }
  } else {
    status.error = 'Pair Carina in Settings first (CARINA_OPS_TOKEN).';
  }

  res.render('human-assist-bridge', {
    title: 'Human assist bridge',
    status,
    saved: req.query['saved'] === '1',
    errMsg: typeof req.query['err'] === 'string' ? req.query['err'] : '',
  });
});

humanAssistBridgeRouter.post('/save', async (req, res) => {
  const body = req.body as {
    enabled?: string;
    misBaseUrl?: string;
    bridgeToken?: string;
    publishMode?: string;
  };
  try {
    const result = await saveHumanAssistBridge({
      enabled: body.enabled === '1',
      misBaseUrl: String(body.misBaseUrl ?? 'https://verlox.uk').trim(),
      bridgeToken: String(body.bridgeToken ?? '').trim() || undefined,
      publishMode: String(body.publishMode ?? 'push_and_poll'),
    });
    if (!result.ok) {
      res.redirect(redirectTo({ err: result.error ?? 'Save failed' }));
      return;
    }
    res.redirect(redirectTo({ saved: '1' }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.redirect(redirectTo({ err: msg.slice(0, 180) }));
  }
});
