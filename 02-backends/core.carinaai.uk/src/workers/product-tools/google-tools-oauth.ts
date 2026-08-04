import { config } from '../../config/index.js';
import {
  buildGoogleWorkspaceAuthUrl,
  GOOGLE_WORKSPACE_SCOPES,
} from '../../integrations/google-workspace-oauth.js';
import { getCatalogTool } from './catalog.js';
import { signGoogleToolsOAuthState, type GoogleToolsOAuthMode } from './google-tools-oauth-state.js';
import { resolveGoogleToolsOAuthRedirectUri } from './google-tools-oauth-redirect.js';

export function isGoogleToolsOAuthConfigured(): boolean {
  return Boolean(config.googleOAuth.clientId && config.googleOAuth.clientSecret);
}

export function buildGoogleToolsAuthUrlForWorker(opts: {
  workspaceId: string;
  workerId: string;
  toolSlug: string;
  redirectUri?: string;
  returnPath?: string;
}): { authUrl: string; redirectUri: string; scopes: string[] } {
  return buildGoogleToolsAuthUrl({
    ...opts,
    mode: 'worker',
  });
}

export function buildGoogleToolsAuthUrl(opts: {
  workspaceId: string;
  workerId?: string;
  toolSlug: string;
  redirectUri?: string;
  returnPath?: string;
  mode?: GoogleToolsOAuthMode;
  orgId?: string;
}): { authUrl: string; redirectUri: string; scopes: string[] } {
  if (!isGoogleToolsOAuthConfigured()) {
    throw new Error('Google OAuth is not configured on this server');
  }
  const tool = getCatalogTool(opts.toolSlug);
  if (!tool || tool.auth !== 'oauth' || tool.oauthProvider !== 'google_workspace') {
    throw new Error('Tool is not a Google Workspace OAuth product tool');
  }
  const mode = opts.mode ?? 'worker';
  if (mode === 'worker' && !opts.workerId) {
    throw new Error('workerId required for worker OAuth mode');
  }
  const redirectUri = resolveGoogleToolsOAuthRedirectUri(opts.redirectUri);
  const state = signGoogleToolsOAuthState({
    workspaceId: opts.workspaceId,
    workerId: opts.workerId ?? '',
    toolSlug: opts.toolSlug,
    redirectUri,
    returnPath: opts.returnPath,
    mode,
    orgId: opts.orgId,
  });
  const built = buildGoogleWorkspaceAuthUrl({
    clientId: config.googleOAuth.clientId,
    redirectUri,
    state,
  });
  return {
    authUrl: built.authUrl,
    redirectUri: built.redirectUri,
    scopes: [...GOOGLE_WORKSPACE_SCOPES],
  };
}
