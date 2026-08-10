import { Router, type Request, type Response, type Router as ExpressRouter } from 'express';
import { requireCloudProxy } from '../gateway/cloud-proxy-auth.js';
import { isAiWorkersEnabled } from '../workers/aiva-message-handler.js';
import { getWorker } from '../workers/worker-store.js';
import { config } from '../config/index.js';
import { exchangeGoogleWorkspaceCode } from '../integrations/google-workspace-oauth.js';
import {
  listPublicProductTools,
  getCatalogTool,
} from '../workers/product-tools/catalog.js';
import { upsertToolSession } from '../workers/product-tools/sessions.js';
import { connectAndProbeTool } from '../workers/product-tools/invoke.js';
import {
  buildGoogleToolsAuthUrl,
  isGoogleToolsOAuthConfigured,
} from '../workers/product-tools/google-tools-oauth.js';
import { verifyGoogleToolsOAuthState } from '../workers/product-tools/google-tools-oauth-state.js';
import { credentialsConfigured } from '../channels/credential-store.js';
import {
  buildZoomAuthUrl,
  exchangeZoomCode,
  isZoomOAuthConfigured,
  resolveZoomRedirectUri,
} from '../workers/product-tools/zoom-oauth.js';
import { signZoomOAuthState, verifyZoomOAuthState } from '../workers/product-tools/zoom-oauth-state.js';

export const aivaToolsOAuthRouter: ExpressRouter = Router();
aivaToolsOAuthRouter.use(requireCloudProxy);

type OAuthRequest = Request & { workspaceId?: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function resolveWorkspaceId(req: OAuthRequest): string | null {
  const header = req.headers['x-workspace-id'];
  const fromHeader = Array.isArray(header) ? header[0] : header;
  const fromQuery = typeof req.query.workspaceId === 'string' ? req.query.workspaceId : '';
  const fromBody = typeof req.body?.workspaceId === 'string' ? req.body.workspaceId : '';
  return (fromHeader ?? fromBody ?? fromQuery)?.trim() || null;
}

aivaToolsOAuthRouter.get('/google/auth-url', async (req: OAuthRequest, res: Response) => {
  try {
    if (!isAiWorkersEnabled()) {
      res.status(503).json({ error: 'AI workers are disabled' });
      return;
    }
    if (!isGoogleToolsOAuthConfigured()) {
      res.status(503).json({ error: 'Google OAuth is not configured on this server' });
      return;
    }
    const workspaceId = resolveWorkspaceId(req);
    if (!workspaceId || !UUID_RE.test(workspaceId)) {
      res.status(400).json({ error: 'Valid workspaceId is required' });
      return;
    }
    const mode = String(req.query.mode ?? 'worker').trim() === 'account' ? 'account' : 'worker';
    const workerId = String(req.query.workerId ?? '').trim();
    const toolSlug = String(req.query.toolSlug ?? 'google-drive').trim();
    if (mode === 'worker') {
      if (!UUID_RE.test(workerId)) {
        res.status(400).json({ error: 'Valid workerId is required' });
        return;
      }
      const worker = await getWorker(workspaceId, workerId);
      if (!worker) {
        res.status(404).json({ error: 'Worker not found' });
        return;
      }
    }
    const returnPath =
      typeof req.query.returnPath === 'string' ? req.query.returnPath.trim() : undefined;
    const orgId = typeof req.query.orgId === 'string' ? req.query.orgId.trim() : undefined;
    const result = buildGoogleToolsAuthUrl({
      workspaceId,
      workerId: mode === 'worker' ? workerId : undefined,
      toolSlug,
      redirectUri: typeof req.query.redirectUri === 'string' ? req.query.redirectUri : undefined,
      returnPath,
      mode,
      orgId,
    });
    res.json({
      authUrl: result.authUrl,
      redirectUri: result.redirectUri,
      scopes: result.scopes,
      mode,
    });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

aivaToolsOAuthRouter.post('/google/callback', async (req: OAuthRequest, res: Response) => {
  try {
    if (!credentialsConfigured()) {
      res.status(503).json({ error: 'CHANNEL_CREDENTIAL_KEY is not configured' });
      return;
    }
    if (!isGoogleToolsOAuthConfigured()) {
      res.status(503).json({ error: 'Google OAuth is not configured on this server' });
      return;
    }
    const code = String(req.body?.code ?? '').trim();
    const state = String(req.body?.state ?? '').trim();
    if (!code || !state) {
      res.status(400).json({ error: 'code and state are required' });
      return;
    }
    const parsed = verifyGoogleToolsOAuthState(state);
    if (!parsed) {
      res.status(400).json({ error: 'Invalid or expired OAuth state' });
      return;
    }

    const tokens = await exchangeGoogleWorkspaceCode({
      code,
      clientId:
        process.env.GOOGLE_CLIENT_ID?.trim()
        || process.env.GOOGLE_OAUTH_CLIENT_ID?.trim()
        || config.googleOAuth.clientId,
      clientSecret:
        process.env.GOOGLE_CLIENT_SECRET?.trim()
        || process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim()
        || config.googleOAuth.clientSecret,
      redirectUri: parsed.redirectUri,
    });

    const credentials: Record<string, string> = {
      access_token: tokens.accessToken,
      ...(tokens.email ? { email: tokens.email } : {}),
      ...(tokens.refreshToken ? { refresh_token: tokens.refreshToken } : {}),
    };

    if (parsed.mode === 'account') {
      const { createAndProbeToolAccount } = await import('../workers/product-tools/accounts.js');
      const primarySlug = parsed.toolSlug;
      const googleTools = listPublicProductTools().filter(
        (tool) => tool.auth === 'oauth' && tool.oauthProvider === 'google_workspace',
      );
      const primary = await createAndProbeToolAccount({
        workspaceId: parsed.workspaceId,
        toolSlug: primarySlug,
        label: tokens.email ? `Google (${tokens.email})` : undefined,
        credentials,
        orgId: parsed.orgId ?? null,
        meta: { email: tokens.email, scope: tokens.scope ?? '', source: 'oauth_account' },
      });
      for (const tool of googleTools) {
        if (tool.slug === primarySlug) continue;
        try {
          await createAndProbeToolAccount({
            workspaceId: parsed.workspaceId,
            toolSlug: tool.slug,
            label: tokens.email ? `Google (${tokens.email})` : tool.label,
            credentials,
            orgId: parsed.orgId ?? null,
            meta: { email: tokens.email, scope: tokens.scope ?? '', source: 'oauth_account' },
          });
        } catch {
          /* sibling account create best-effort */
        }
      }
      res.json({
        ok: primary.ok,
        mode: 'account',
        toolSlug: primarySlug,
        email: tokens.email,
        accountId: primary.account?.id ?? null,
        error: primary.error,
        returnPath: parsed.returnPath ?? '/aiva/tools',
      });
      return;
    }

    const worker = await getWorker(parsed.workspaceId, parsed.workerId);
    if (!worker) {
      res.status(404).json({ error: 'Worker not found' });
      return;
    }

    const expiresAt = new Date(tokens.expiryDate);
    const googleTools = listPublicProductTools().filter(
      (tool) => tool.auth === 'oauth' && tool.oauthProvider === 'google_workspace',
    );
    for (const tool of googleTools) {
      await upsertToolSession({
        workspaceId: parsed.workspaceId,
        workerId: parsed.workerId,
        toolSlug: tool.slug,
        provider: 'google_workspace',
        credentials,
        meta: { email: tokens.email, scope: tokens.scope ?? '' },
        expiresAt,
      });
    }

    const primarySlug = parsed.toolSlug;
    const probed = await connectAndProbeTool({
      workspaceId: parsed.workspaceId,
      workerId: parsed.workerId,
      slug: primarySlug,
      scopes: getCatalogTool(primarySlug)?.scopes,
    });

    for (const tool of googleTools) {
      if (tool.slug === primarySlug) continue;
      try {
        await connectAndProbeTool({
          workspaceId: parsed.workspaceId,
          workerId: parsed.workerId,
          slug: tool.slug,
          scopes: getCatalogTool(tool.slug)?.scopes,
        });
      } catch {
        // ignore sibling probe failures
      }
    }

    res.json({
      ok: probed.ok,
      mode: 'worker',
      toolSlug: primarySlug,
      email: tokens.email,
      grantStatus: probed.grantStatus,
      error: probed.error,
      returnPath: parsed.returnPath ?? null,
    });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

aivaToolsOAuthRouter.post('/zoom/callback', async (req: OAuthRequest, res: Response) => {
  try {
    if (!credentialsConfigured()) {
      res.status(503).json({ error: 'CHANNEL_CREDENTIAL_KEY is not configured' });
      return;
    }
    if (!isZoomOAuthConfigured()) {
      res.status(503).json({ error: 'Zoom OAuth is not configured on this server' });
      return;
    }
    const code = String(req.body?.code ?? '').trim();
    const state = String(req.body?.state ?? '').trim();
    if (!code || !state) {
      res.status(400).json({ error: 'code and state are required' });
      return;
    }
    const parsed = verifyZoomOAuthState(state);
    if (!parsed) {
      res.status(400).json({ error: 'Invalid or expired OAuth state' });
      return;
    }
    const tokens = await exchangeZoomCode({ code, redirectUri: parsed.redirectUri });
    await upsertToolSession({
      workspaceId: parsed.workspaceId,
      workerId: parsed.workerId,
      toolSlug: 'zoom',
      provider: 'zoom',
      credentials: {
        access_token: tokens.accessToken,
        ...(tokens.refreshToken ? { refresh_token: tokens.refreshToken } : {}),
      },
      meta: { connectedVia: 'zoom-oauth', expiresIn: tokens.expiresIn },
      expiresAt: tokens.expiresIn
        ? new Date(Date.now() + tokens.expiresIn * 1000)
        : null,
    });
    res.json({
      connected: true,
      returnPath: parsed.returnPath ?? `/aiva/workers/${parsed.workerId}?tab=concierge`,
    });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

aivaToolsOAuthRouter.get('/zoom/auth-url', async (req: OAuthRequest, res: Response) => {
  try {
    if (!isZoomOAuthConfigured()) {
      res.status(503).json({ error: 'Zoom OAuth is not configured on this server' });
      return;
    }
    const workspaceId = resolveWorkspaceId(req);
    const workerId = String(req.query.workerId ?? '').trim();
    if (!workspaceId || !UUID_RE.test(workspaceId) || !UUID_RE.test(workerId)) {
      res.status(400).json({ error: 'Valid workspaceId and workerId are required' });
      return;
    }
    const worker = await getWorker(workspaceId, workerId);
    if (!worker) {
      res.status(404).json({ error: 'Worker not found' });
      return;
    }
    const returnPath =
      typeof req.query.returnPath === 'string'
        ? req.query.returnPath.trim()
        : `/aiva/workers/${workerId}?tab=concierge`;
    const redirectUri = resolveZoomRedirectUri(
      typeof req.query.redirectUri === 'string' ? req.query.redirectUri : undefined,
    );
    const state = signZoomOAuthState({
      workspaceId,
      workerId,
      redirectUri,
      returnPath,
    });
    const built = buildZoomAuthUrl({ state, redirectUri });
    res.json({ authUrl: built.authUrl, redirectUri });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
