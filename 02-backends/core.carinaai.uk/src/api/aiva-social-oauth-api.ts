import { Router, type Request, type Response, type Router as ExpressRouter } from 'express';
import { requireCloudProxy } from '../gateway/cloud-proxy-auth.js';
import { isAiWorkersEnabled } from '../workers/aiva-message-handler.js';
import { getWorker } from '../workers/worker-store.js';
import {
  exchangeLinkedInCode,
  getLinkedInAuthUrl,
  isLinkedInOAuthConfigured,
} from '../ingestion/social/linkedin-oauth.js';
import {
  exchangeMetaCode,
  exchangeMetaLongLivedUserToken,
  fetchMetaPageAccessToken,
  getMetaAuthUrl,
  isMetaOAuthConfigured,
  listMetaManagedPages,
} from '../ingestion/social/meta-oauth.js';
import {
  exchangeTwitterAccessToken,
  getTwitterRequestToken,
  isTwitterOAuthConfigured,
} from '../ingestion/social/twitter-oauth.js';
import {
  exchangeTikTokCode,
  getTikTokAuthUrl,
  isTikTokOAuthConfigured,
} from '../ingestion/social/tiktok-oauth.js';
import {
  randomOAuthSecret,
  signSocialOAuthState,
  verifySocialOAuthState,
} from '../ingestion/social/social-oauth-state.js';
import { resolveSocialOAuthRedirectUri } from '../ingestion/social/social-oauth-redirect.js';
import { finishSocialOAuthConnection } from '../ingestion/social/social-oauth-finish.js';

export const aivaSocialOAuthRouter: ExpressRouter = Router();
aivaSocialOAuthRouter.use(requireCloudProxy);

type OAuthRequest = Request & { workspaceId?: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  const workerId = String(req.query.workerId ?? req.body?.workerId ?? '').trim();
  if (!UUID_RE.test(workerId)) {
    res.status(400).json({ error: 'Valid workerId is required' });
    return null;
  }
  return { workspaceId, workerId };
}

aivaSocialOAuthRouter.get('/linkedin/auth-url', async (req: OAuthRequest, res: Response) => {
  try {
    if (!isLinkedInOAuthConfigured()) {
      res.status(503).json({ error: 'LinkedIn OAuth is not configured on this server' });
      return;
    }
    const ctx = requireOAuthContext(req, res);
    if (!ctx) return;
    const worker = await getWorker(ctx.workspaceId, ctx.workerId);
    if (!worker) {
      res.status(404).json({ error: 'Worker not found' });
      return;
    }
    const redirectUri = resolveSocialOAuthRedirectUri(
      typeof req.query.redirectUri === 'string' ? req.query.redirectUri : undefined,
      'linkedin',
    );
    const state = signSocialOAuthState({
      workspaceId: ctx.workspaceId,
      workerId: ctx.workerId,
      provider: 'linkedin',
      redirectUri,
      phase: 'auth',
    });
    res.json({ authUrl: getLinkedInAuthUrl(state, redirectUri) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

aivaSocialOAuthRouter.post('/linkedin/callback', async (req: OAuthRequest, res: Response) => {
  try {
    const code = String(req.body?.code ?? '').trim();
    const state = String(req.body?.state ?? '').trim();
    if (!code || !state) {
      res.status(400).json({ error: 'code and state are required' });
      return;
    }
    const parsed = verifySocialOAuthState(state);
    if (!parsed || parsed.provider !== 'linkedin') {
      res.status(400).json({ error: 'Invalid or expired OAuth state' });
      return;
    }
    const redirectUri = parsed.redirectUri
      ?? (typeof req.body?.redirectUri === 'string' ? req.body.redirectUri : undefined)
      ?? resolveSocialOAuthRedirectUri(undefined, 'linkedin');
    const tokens = await exchangeLinkedInCode(code, redirectUri);
    const webhookSecret = randomOAuthSecret();
    const result = await finishSocialOAuthConnection({
      workspaceId: parsed.workspaceId,
      workerId: parsed.workerId,
      channel: 'linkedin',
      identifier: tokens.memberId,
      credentials: {
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        expires_at: tokens.expiresAt,
        member_id: tokens.memberId,
        webhook_secret: webhookSecret,
      },
    });
    if (!result.ok) {
      res.status(400).json({ error: result.error ?? 'LinkedIn connection failed' });
      return;
    }
    res.json({ ok: true, provider: 'linkedin', workerId: parsed.workerId });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

aivaSocialOAuthRouter.get('/meta/auth-url', async (req: OAuthRequest, res: Response) => {
  try {
    if (!isMetaOAuthConfigured()) {
      res.status(503).json({ error: 'Meta OAuth is not configured on this server' });
      return;
    }
    const ctx = requireOAuthContext(req, res);
    if (!ctx) return;
    const worker = await getWorker(ctx.workspaceId, ctx.workerId);
    if (!worker) {
      res.status(404).json({ error: 'Worker not found' });
      return;
    }
    const redirectUri = resolveSocialOAuthRedirectUri(
      typeof req.query.redirectUri === 'string' ? req.query.redirectUri : undefined,
      'meta',
    );
    const state = signSocialOAuthState({
      workspaceId: ctx.workspaceId,
      workerId: ctx.workerId,
      provider: 'meta',
      redirectUri,
      phase: 'auth',
    });
    res.json({ authUrl: getMetaAuthUrl(state, redirectUri) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

aivaSocialOAuthRouter.post('/meta/callback', async (req: OAuthRequest, res: Response) => {
  try {
    const code = String(req.body?.code ?? '').trim();
    const state = String(req.body?.state ?? '').trim();
    if (!code || !state) {
      res.status(400).json({ error: 'code and state are required' });
      return;
    }
    const parsed = verifySocialOAuthState(state);
    if (!parsed || parsed.provider !== 'meta') {
      res.status(400).json({ error: 'Invalid or expired OAuth state' });
      return;
    }
    const redirectUri = parsed.redirectUri
      ?? (typeof req.body?.redirectUri === 'string' ? req.body.redirectUri : undefined)
      ?? resolveSocialOAuthRedirectUri(undefined, 'meta');
    const shortToken = await exchangeMetaCode(code, redirectUri);
    const userToken = await exchangeMetaLongLivedUserToken(shortToken.accessToken);
    const pages = await listMetaManagedPages(userToken.accessToken);
    const connectToken = signSocialOAuthState({
      workspaceId: parsed.workspaceId,
      workerId: parsed.workerId,
      provider: 'meta',
      phase: 'meta_page_select',
      userAccessToken: userToken.accessToken,
      tokenExpiresAt: userToken.expiresAt,
    });
    res.json({
      ok: true,
      workerId: parsed.workerId,
      pages,
      connectToken,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

aivaSocialOAuthRouter.get('/meta/pages', async (req: OAuthRequest, res: Response) => {
  try {
    const connectToken = String(req.query.connectToken ?? '').trim();
    const parsed = verifySocialOAuthState(connectToken, 30 * 60 * 1000);
    if (!parsed || parsed.provider !== 'meta' || !parsed.userAccessToken) {
      res.status(400).json({ error: 'Invalid or expired Meta connect token' });
      return;
    }
    const pages = await listMetaManagedPages(parsed.userAccessToken);
    res.json({ pages });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

aivaSocialOAuthRouter.post('/meta/connect', async (req: OAuthRequest, res: Response) => {
  try {
    const connectToken = String(req.body?.connectToken ?? '').trim();
    const pageId = String(req.body?.pageId ?? '').trim();
    const enableInstagram = Boolean(req.body?.enableInstagram);
    if (!connectToken || !pageId) {
      res.status(400).json({ error: 'connectToken and pageId are required' });
      return;
    }
    const parsed = verifySocialOAuthState(connectToken, 30 * 60 * 1000);
    if (!parsed || parsed.provider !== 'meta' || parsed.phase !== 'meta_page_select' || !parsed.userAccessToken) {
      res.status(400).json({ error: 'Invalid or expired Meta connect token' });
      return;
    }
    const pageTokens = await fetchMetaPageAccessToken(parsed.userAccessToken, pageId);
    const verifyToken = randomOAuthSecret(16);

    const messengerResult = await finishSocialOAuthConnection({
      workspaceId: parsed.workspaceId,
      workerId: parsed.workerId,
      channel: 'messenger',
      identifier: pageId,
      credentials: {
        page_id: pageId,
        page_access_token: pageTokens.pageAccessToken,
        app_id: process.env.META_APP_ID?.trim() ?? '',
        user_access_token: parsed.userAccessToken,
        token_expires_at: parsed.tokenExpiresAt ?? '',
        verify_token: verifyToken,
      },
    });
    if (!messengerResult.ok) {
      res.status(400).json({ error: messengerResult.error ?? 'Messenger connection failed' });
      return;
    }

    if (enableInstagram && pageTokens.instagramBusinessAccountId) {
      const instagramResult = await finishSocialOAuthConnection({
        workspaceId: parsed.workspaceId,
        workerId: parsed.workerId,
        channel: 'instagram',
        identifier: pageTokens.instagramBusinessAccountId,
        credentials: {
          page_id: pageId,
          page_access_token: pageTokens.pageAccessToken,
          instagram_business_account_id: pageTokens.instagramBusinessAccountId,
          app_id: process.env.META_APP_ID?.trim() ?? '',
          user_access_token: parsed.userAccessToken,
          token_expires_at: parsed.tokenExpiresAt ?? '',
          verify_token: verifyToken,
        },
      });
      if (!instagramResult.ok) {
        res.status(400).json({ error: instagramResult.error ?? 'Instagram connection failed' });
        return;
      }
    }

    res.json({
      ok: true,
      provider: 'meta',
      workerId: parsed.workerId,
      messengerConnected: true,
      instagramConnected: Boolean(enableInstagram && pageTokens.instagramBusinessAccountId),
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

aivaSocialOAuthRouter.get('/twitter/auth-url', async (req: OAuthRequest, res: Response) => {
  try {
    if (!isTwitterOAuthConfigured()) {
      res.status(503).json({ error: 'Twitter OAuth is not configured on this server' });
      return;
    }
    const ctx = requireOAuthContext(req, res);
    if (!ctx) return;
    const worker = await getWorker(ctx.workspaceId, ctx.workerId);
    if (!worker) {
      res.status(404).json({ error: 'Worker not found' });
      return;
    }
    const redirectUri = resolveSocialOAuthRedirectUri(
      typeof req.query.redirectUri === 'string' ? req.query.redirectUri : undefined,
      'twitter',
    );
    const requestToken = await getTwitterRequestToken(redirectUri);
    const state = signSocialOAuthState({
      workspaceId: ctx.workspaceId,
      workerId: ctx.workerId,
      provider: 'twitter',
      redirectUri,
      oauthTokenSecret: requestToken.oauthTokenSecret,
      phase: 'auth',
    });
    res.json({ authUrl: requestToken.authUrl, state });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

aivaSocialOAuthRouter.post('/twitter/callback', async (req: OAuthRequest, res: Response) => {
  try {
    const oauthToken = String(req.body?.oauthToken ?? req.body?.oauth_token ?? '').trim();
    const oauthVerifier = String(req.body?.oauthVerifier ?? req.body?.oauth_verifier ?? '').trim();
    const state = String(req.body?.state ?? '').trim();
    if (!oauthToken || !oauthVerifier || !state) {
      res.status(400).json({ error: 'oauthToken, oauthVerifier, and state are required' });
      return;
    }
    const parsed = verifySocialOAuthState(state);
    if (!parsed || parsed.provider !== 'twitter' || !parsed.oauthTokenSecret) {
      res.status(400).json({ error: 'Invalid or expired OAuth state' });
      return;
    }
    const tokens = await exchangeTwitterAccessToken(
      oauthToken,
      oauthVerifier,
      parsed.oauthTokenSecret,
    );
    const result = await finishSocialOAuthConnection({
      workspaceId: parsed.workspaceId,
      workerId: parsed.workerId,
      channel: 'twitter',
      identifier: tokens.userId,
      credentials: {
        api_key: process.env.TWITTER_API_KEY?.trim() ?? '',
        api_secret: process.env.TWITTER_API_SECRET?.trim() ?? '',
        access_token: tokens.accessToken,
        access_token_secret: tokens.accessTokenSecret,
        user_id: tokens.userId,
        webhook_env: process.env.TWITTER_WEBHOOK_ENV?.trim() || 'prod',
      },
    });
    if (!result.ok) {
      res.status(400).json({ error: result.error ?? 'Twitter connection failed' });
      return;
    }
    res.json({ ok: true, provider: 'twitter', workerId: parsed.workerId });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

aivaSocialOAuthRouter.get('/tiktok/auth-url', async (req: OAuthRequest, res: Response) => {
  try {
    if (!isTikTokOAuthConfigured()) {
      res.status(503).json({ error: 'TikTok OAuth is not configured on this server' });
      return;
    }
    const ctx = requireOAuthContext(req, res);
    if (!ctx) return;
    const worker = await getWorker(ctx.workspaceId, ctx.workerId);
    if (!worker) {
      res.status(404).json({ error: 'Worker not found' });
      return;
    }
    const redirectUri = resolveSocialOAuthRedirectUri(
      typeof req.query.redirectUri === 'string' ? req.query.redirectUri : undefined,
      'tiktok',
    );
    const state = signSocialOAuthState({
      workspaceId: ctx.workspaceId,
      workerId: ctx.workerId,
      provider: 'tiktok',
      redirectUri,
      phase: 'auth',
    });
    res.json({ authUrl: getTikTokAuthUrl(state, redirectUri) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

aivaSocialOAuthRouter.post('/tiktok/callback', async (req: OAuthRequest, res: Response) => {
  try {
    const code = String(req.body?.code ?? '').trim();
    const state = String(req.body?.state ?? '').trim();
    if (!code || !state) {
      res.status(400).json({ error: 'code and state are required' });
      return;
    }
    const parsed = verifySocialOAuthState(state);
    if (!parsed || parsed.provider !== 'tiktok') {
      res.status(400).json({ error: 'Invalid or expired OAuth state' });
      return;
    }
    const redirectUri = parsed.redirectUri
      ?? (typeof req.body?.redirectUri === 'string' ? req.body.redirectUri : undefined)
      ?? resolveSocialOAuthRedirectUri(undefined, 'tiktok');
    const tokens = await exchangeTikTokCode(code, redirectUri);
    const result = await finishSocialOAuthConnection({
      workspaceId: parsed.workspaceId,
      workerId: parsed.workerId,
      channel: 'tiktok',
      identifier: tokens.openId,
      credentials: {
        open_id: tokens.openId,
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        expires_at: tokens.expiresAt,
      },
      verified: false,
    });
    if (!result.ok) {
      res.status(400).json({ error: result.error ?? 'TikTok connection failed' });
      return;
    }
    res.json({
      ok: true,
      provider: 'tiktok',
      workerId: parsed.workerId,
      pendingReview: true,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
