import { Router, type Request, type Response, type Router as ExpressRouter } from 'express';
import { requireCloudProxy } from '../gateway/cloud-proxy-auth.js';
import { credentialsConfigured } from '../channels/credential-store.js';
import {
  buildYouTubeAuthUrl,
  exchangeYouTubeCode,
  isYouTubeOAuthConfigured,
  verifyYouTubeOAuthState,
} from '../connectors/youtube/auth.js';
import { getOrVerifyChannel } from '../connectors/youtube/channel.js';
import { createYouTubeClient } from '../connectors/youtube/client.js';
import { saveYouTubeTokens } from '../connectors/youtube/token-store.js';

export const aivaYouTubeOAuthRouter: ExpressRouter = Router();
aivaYouTubeOAuthRouter.use(requireCloudProxy);

type OAuthRequest = Request & { workspaceId?: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function resolveWorkspaceId(req: OAuthRequest): string | null {
  const header = req.headers['x-workspace-id'];
  const fromHeader = Array.isArray(header) ? header[0] : header;
  const fromQuery = typeof req.query.workspaceId === 'string' ? req.query.workspaceId : '';
  const fromBody = typeof req.body?.workspaceId === 'string' ? req.body.workspaceId : '';
  return (fromHeader ?? fromBody ?? fromQuery)?.trim() || null;
}

aivaYouTubeOAuthRouter.get('/auth-url', (req: OAuthRequest, res: Response) => {
  try {
    if (!isYouTubeOAuthConfigured()) {
      res.status(503).json({ error: 'YouTube OAuth is not configured on this server' });
      return;
    }
    const workspaceId = resolveWorkspaceId(req);
    if (!workspaceId || !UUID_RE.test(workspaceId)) {
      res.status(400).json({ error: 'Valid workspaceId is required' });
      return;
    }
    const returnPath = typeof req.query.returnPath === 'string' ? req.query.returnPath : undefined;
    const result = buildYouTubeAuthUrl({ workspaceId, returnPath });
    res.json({ authUrl: result.authUrl, redirectUri: result.redirectUri, scopes: result.scopes });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

aivaYouTubeOAuthRouter.post('/callback', async (req: OAuthRequest, res: Response) => {
  try {
    if (!credentialsConfigured()) {
      res.status(503).json({ error: 'CHANNEL_CREDENTIAL_KEY is not configured' });
      return;
    }
    if (!isYouTubeOAuthConfigured()) {
      res.status(503).json({ error: 'YouTube OAuth is not configured on this server' });
      return;
    }
    const code = String(req.body?.code ?? '').trim();
    const state = String(req.body?.state ?? '').trim();
    if (!code || !state) {
      res.status(400).json({ error: 'code and state are required' });
      return;
    }
    const parsed = verifyYouTubeOAuthState(state);
    if (!parsed) {
      res.status(400).json({ error: 'Invalid or expired OAuth state' });
      return;
    }

    const tokens = await exchangeYouTubeCode({ code, redirectUri: parsed.redirectUri });

    // The channel ID is not known until we can call channels.list with the
    // fresh access token, so tokens are saved under a temporary key first.
    const tempChannelId = `pending-${parsed.workspaceId}`;
    saveYouTubeTokens(parsed.workspaceId, tempChannelId, tokens);
    const client = createYouTubeClient(parsed.workspaceId, tempChannelId);
    const channel = await getOrVerifyChannel(client);

    saveYouTubeTokens(parsed.workspaceId, channel.id, tokens);

    res.json({
      ok: true,
      channelId: channel.id,
      channelTitle: channel.title,
      returnPath: parsed.returnPath ?? null,
    });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
