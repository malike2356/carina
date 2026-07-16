import { Router, type Request, type Response, type Router as ExpressRouter } from 'express';
import { requireCloudProxy } from '../gateway/cloud-proxy-auth.js';
import { isAiWorkersEnabled } from '../workers/aiva-message-handler.js';
import { isEmailIngestionEnabledForWorkspace } from '../workers/aiva-feature-flags.js';
import { getWorker } from '../workers/worker-store.js';
import {
  addSender,
  getEmailConnection,
  upsertEmailConnection,
} from '../ingestion/email/email-connection-store.js';
import { testImapConnection } from '../ingestion/email/imap-connector.js';
import {
  exchangeCodeForTokens,
  getGmailAuthUrl,
  isGmailOAuthConfigured,
} from '../ingestion/email/gmail-oauth.js';
import {
  exchangeOutlookCodeForTokens,
  getOutlookAuthUrl,
  isOutlookOAuthConfigured,
} from '../ingestion/email/outlook-oauth.js';
import {
  signEmailOAuthState,
  verifyEmailOAuthState,
} from '../ingestion/email/email-oauth-state.js';
import { resolveEmailOAuthRedirectUri } from '../ingestion/email/email-oauth-redirect.js';
import { credentialsConfigured } from '../channels/credential-store.js';

export const aivaEmailOAuthRouter: ExpressRouter = Router();
aivaEmailOAuthRouter.use(requireCloudProxy);

type OAuthRequest = Request & { workspaceId?: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const GMAIL_IMAP = { host: 'imap.gmail.com', port: 993, tls: true };
const OUTLOOK_IMAP = { host: 'outlook.office365.com', port: 993, tls: true };

function resolveWorkspaceId(req: OAuthRequest): string | null {
  const header = req.headers['x-workspace-id'];
  const fromHeader = Array.isArray(header) ? header[0] : header;
  const fromQuery = typeof req.query.workspaceId === 'string' ? req.query.workspaceId : '';
  const fromBody = typeof req.body?.workspaceId === 'string' ? req.body.workspaceId : '';
  return (fromHeader ?? fromBody ?? fromQuery)?.trim() || null;
}

function requireOAuthContext(req: OAuthRequest, res: Response): { workspaceId: string; workerId: string } | null {
  if (!isAiWorkersEnabled()) {
    res.status(503).json({ error: 'AI workers are disabled' });
    return null;
  }
  const workspaceId = resolveWorkspaceId(req);
  if (!workspaceId || !UUID_RE.test(workspaceId)) {
    res.status(400).json({ error: 'Valid workspaceId is required' });
    return null;
  }
  if (!isEmailIngestionEnabledForWorkspace(workspaceId)) {
    res.status(503).json({ error: 'Email ingestion is disabled for this workspace' });
    return null;
  }
  const workerId = String(req.query.workerId ?? req.body?.workerId ?? '').trim();
  if (!UUID_RE.test(workerId)) {
    res.status(400).json({ error: 'Valid workerId is required' });
    return null;
  }
  return { workspaceId, workerId };
}

async function finishOAuthConnection(input: {
  workspaceId: string;
  workerId: string;
  provider: 'gmail' | 'outlook';
  email: string;
  refreshToken: string;
  accessToken: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!credentialsConfigured()) {
    return { ok: false, error: 'CHANNEL_CREDENTIAL_KEY is not configured' };
  }

  const worker = await getWorker(input.workspaceId, input.workerId);
  if (!worker) return { ok: false, error: 'Worker not found' };

  const imap = input.provider === 'gmail' ? GMAIL_IMAP : OUTLOOK_IMAP;
  const test = await testImapConnection({
    type: 'oauth2',
    params: {
      ...imap,
      username: input.email,
      accessToken: input.accessToken,
    },
  });
  if (!test.ok) {
    return { ok: false, error: test.error ?? 'IMAP connection failed after OAuth' };
  }

  const connection = await upsertEmailConnection(input.workerId, {
    imapHost: imap.host,
    imapPort: imap.port,
    imapTls: imap.tls,
    username: input.email,
    password: '',
    oauthProvider: input.provider,
    oauthRefreshToken: input.refreshToken,
    status: 'connected',
  });

  await addSender(connection.id, input.email, 'client');
  return { ok: true };
}

aivaEmailOAuthRouter.get('/gmail/auth-url', async (req: OAuthRequest, res: Response) => {
  try {
    if (!isGmailOAuthConfigured()) {
      res.status(503).json({ error: 'Gmail OAuth is not configured on this server' });
      return;
    }
    const ctx = requireOAuthContext(req, res);
    if (!ctx) return;
    const worker = await getWorker(ctx.workspaceId, ctx.workerId);
    if (!worker) {
      res.status(404).json({ error: 'Worker not found' });
      return;
    }
    const redirectUri = resolveEmailOAuthRedirectUri(
      typeof req.query.redirectUri === 'string' ? req.query.redirectUri : undefined,
      'gmail',
    );
    const state = signEmailOAuthState({
      workspaceId: ctx.workspaceId,
      workerId: ctx.workerId,
      provider: 'gmail',
      redirectUri,
    });
    res.json({ authUrl: getGmailAuthUrl(state, redirectUri) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

aivaEmailOAuthRouter.get('/outlook/auth-url', async (req: OAuthRequest, res: Response) => {
  try {
    if (!isOutlookOAuthConfigured()) {
      res.status(503).json({ error: 'Microsoft OAuth is not configured on this server' });
      return;
    }
    const ctx = requireOAuthContext(req, res);
    if (!ctx) return;
    const worker = await getWorker(ctx.workspaceId, ctx.workerId);
    if (!worker) {
      res.status(404).json({ error: 'Worker not found' });
      return;
    }
    const redirectUri = resolveEmailOAuthRedirectUri(
      typeof req.query.redirectUri === 'string' ? req.query.redirectUri : undefined,
      'outlook',
    );
    const state = signEmailOAuthState({
      workspaceId: ctx.workspaceId,
      workerId: ctx.workerId,
      provider: 'outlook',
      redirectUri,
    });
    res.json({ authUrl: getOutlookAuthUrl(state, redirectUri) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

aivaEmailOAuthRouter.post('/gmail/callback', async (req: OAuthRequest, res: Response) => {
  try {
    const code = String(req.body?.code ?? '').trim();
    const state = String(req.body?.state ?? '').trim();
    if (!code || !state) {
      res.status(400).json({ error: 'code and state are required' });
      return;
    }
    const parsed = verifyEmailOAuthState(state);
    if (!parsed || parsed.provider !== 'gmail') {
      res.status(400).json({ error: 'Invalid or expired OAuth state' });
      return;
    }
    const tokens = await exchangeCodeForTokens(
      code,
      parsed.redirectUri
        ?? (typeof req.body?.redirectUri === 'string' ? req.body.redirectUri : undefined)
        ?? resolveEmailOAuthRedirectUri(undefined, 'gmail'),
    );
    const result = await finishOAuthConnection({
      workspaceId: parsed.workspaceId,
      workerId: parsed.workerId,
      provider: 'gmail',
      email: tokens.email,
      refreshToken: tokens.refreshToken,
      accessToken: tokens.accessToken,
    });
    if (!result.ok) {
      res.status(400).json({ error: result.error ?? 'OAuth connection failed' });
      return;
    }
    res.json({ ok: true, provider: 'gmail', email: tokens.email });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

aivaEmailOAuthRouter.post('/outlook/callback', async (req: OAuthRequest, res: Response) => {
  try {
    const code = String(req.body?.code ?? '').trim();
    const state = String(req.body?.state ?? '').trim();
    if (!code || !state) {
      res.status(400).json({ error: 'code and state are required' });
      return;
    }
    const parsed = verifyEmailOAuthState(state);
    if (!parsed || parsed.provider !== 'outlook') {
      res.status(400).json({ error: 'Invalid or expired OAuth state' });
      return;
    }
    const tokens = await exchangeOutlookCodeForTokens(
      code,
      parsed.redirectUri
        ?? (typeof req.body?.redirectUri === 'string' ? req.body.redirectUri : undefined)
        ?? resolveEmailOAuthRedirectUri(undefined, 'outlook'),
    );
    const result = await finishOAuthConnection({
      workspaceId: parsed.workspaceId,
      workerId: parsed.workerId,
      provider: 'outlook',
      email: tokens.email,
      refreshToken: tokens.refreshToken,
      accessToken: tokens.accessToken,
    });
    if (!result.ok) {
      res.status(400).json({ error: result.error ?? 'OAuth connection failed' });
      return;
    }
    res.json({ ok: true, provider: 'outlook', email: tokens.email });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});
