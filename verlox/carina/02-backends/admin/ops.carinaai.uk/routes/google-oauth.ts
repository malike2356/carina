import { Router } from 'express';
import {
  applyGoogleOAuthCredentials,
  fetchGoogleOAuthStatus,
  GOOGLE_OAUTH_REDIRECT_URIS,
  type GoogleOAuthStatus,
} from '../lib/google-oauth-apply.js';
import { carinaOpsTokenSet } from '../lib/carina.js';
import { hrefWithUiVersion } from '../lib/callback-url.js';

export const googleOAuthRouter = Router();

const uiVersion = process.env.UI_VERSION ?? '20260714g';

function googleOAuthRedirect(query: Record<string, string>): string {
  const params = new URLSearchParams(query);
  return hrefWithUiVersion(`/google-oauth?${params.toString()}`, uiVersion);
}

googleOAuthRouter.get('/', async (req, res) => {
  let status: GoogleOAuthStatus = {
    configured: false,
    clientIdSet: false,
    clientSecretSet: false,
    redirectUris: [...GOOGLE_OAUTH_REDIRECT_URIS],
    source: 'none',
  };

  if (carinaOpsTokenSet()) {
    try {
      status = { ...status, ...(await fetchGoogleOAuthStatus()) };
    } catch (err) {
      status.error = err instanceof Error ? err.message : String(err);
    }
  } else {
    status.error = 'Pair Carina in Settings first (CARINA_OPS_TOKEN).';
  }

  res.render('google-oauth', {
    title: 'Google OAuth',
    status,
    saved: req.query['saved'] === '1',
    restarted: req.query['restarted'] === '1',
    restartWarn: req.query['restart_warn'] === '1',
    filesCount: typeof req.query['files'] === 'string' ? req.query['files'] : '',
    errMsg: typeof req.query['err'] === 'string' ? req.query['err'] : '',
  });
});

googleOAuthRouter.post('/save', async (req, res) => {
  const body = req.body as {
    clientId?: string;
    clientSecret?: string;
    doRestart?: string;
  };
  const clientId = String(body.clientId ?? '').trim();
  const clientSecret = String(body.clientSecret ?? '').trim();
  const restartServices = body.doRestart === '1';

  if (!carinaOpsTokenSet()) {
    res.redirect(googleOAuthRedirect({ err: 'Pair Carina in Settings first' }));
    return;
  }

  try {
    const result = await applyGoogleOAuthCredentials({
      clientId,
      clientSecret,
      restartServices,
    });
    if (!result.ok && !result.coreSaved) {
      res.redirect(googleOAuthRedirect({ err: result.error ?? 'Save failed' }));
      return;
    }
    const query: Record<string, string> = { saved: '1' };
    if (result.filesUpdated?.length) query.files = String(result.filesUpdated.length);
    if (result.restarted) query.restarted = '1';
    if (result.restartError || (result.coreSaved && !result.ok)) query.restart_warn = '1';
    if (result.error && result.coreSaved) query.err = result.error.slice(0, 180);
    res.redirect(googleOAuthRedirect(query));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.redirect(googleOAuthRedirect({ err: msg.slice(0, 180) }));
  }
});
