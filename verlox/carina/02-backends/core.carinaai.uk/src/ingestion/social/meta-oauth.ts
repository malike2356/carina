import { config } from '../../config/index.js';

const GRAPH_VERSION = 'v20.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;
const META_SCOPES = [
  'pages_show_list',
  'pages_messaging',
  'instagram_manage_messages',
  'pages_manage_metadata',
];

export interface MetaPageOption {
  id: string;
  name: string;
  instagramBusinessAccountId?: string;
}

export interface MetaUserToken {
  accessToken: string;
  expiresAt: string;
}

function appId(): string {
  return config.socialOAuth.meta.appId;
}

function appSecret(): string {
  return config.socialOAuth.meta.appSecret;
}

export function isMetaOAuthConfigured(): boolean {
  return Boolean(appId() && appSecret());
}

export function getMetaAuthUrl(state: string, redirectUri: string): string {
  if (!isMetaOAuthConfigured()) {
    throw new Error('Meta OAuth is not configured on this server');
  }
  const params = new URLSearchParams({
    client_id: appId(),
    redirect_uri: redirectUri,
    state,
    scope: META_SCOPES.join(','),
    response_type: 'code',
  });
  return `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?${params.toString()}`;
}

export async function exchangeMetaCode(code: string, redirectUri: string): Promise<MetaUserToken> {
  const url = new URL(`${GRAPH_BASE}/oauth/access_token`);
  url.searchParams.set('client_id', appId());
  url.searchParams.set('client_secret', appSecret());
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('code', code);
  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Meta OAuth code exchange failed with HTTP ${response.status}`);
  }
  const body = await response.json() as { access_token?: string; expires_in?: number };
  if (!body.access_token) {
    throw new Error('Meta OAuth did not return access_token');
  }
  return {
    accessToken: body.access_token,
    expiresAt: new Date(Date.now() + Math.max(0, body.expires_in ?? 3600) * 1000).toISOString(),
  };
}

export async function listMetaManagedPages(userAccessToken: string): Promise<MetaPageOption[]> {
  const url = new URL(`${GRAPH_BASE}/me/accounts`);
  url.searchParams.set(
    'fields',
    'id,name,access_token,instagram_business_account{id}',
  );
  url.searchParams.set('access_token', userAccessToken);
  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Meta page list failed with HTTP ${response.status}`);
  }
  const body = await response.json() as {
    data?: Array<{
      id?: string;
      name?: string;
      access_token?: string;
      instagram_business_account?: { id?: string };
    }>;
  };
  return (body.data ?? [])
    .filter((page) => page.id)
    .map((page) => ({
      id: String(page.id),
      name: String(page.name ?? page.id),
      instagramBusinessAccountId: page.instagram_business_account?.id
        ? String(page.instagram_business_account.id)
        : undefined,
    }));
}

export async function fetchMetaPageAccessToken(
  userAccessToken: string,
  pageId: string,
): Promise<{ pageAccessToken: string; instagramBusinessAccountId?: string }> {
  const pages = await listMetaManagedPages(userAccessToken);
  const page = pages.find((item) => item.id === pageId);
  if (!page) {
    throw new Error('Selected Meta page is not available for this user');
  }
  const url = new URL(`${GRAPH_BASE}/me/accounts`);
  url.searchParams.set('fields', 'access_token,instagram_business_account{id}');
  url.searchParams.set('access_token', userAccessToken);
  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Meta page token lookup failed with HTTP ${response.status}`);
  }
  const body = await response.json() as {
    data?: Array<{
      id?: string;
      access_token?: string;
      instagram_business_account?: { id?: string };
    }>;
  };
  const match = (body.data ?? []).find((item) => item.id === pageId);
  if (!match?.access_token) {
    throw new Error('Meta page access token not found');
  }
  return {
    pageAccessToken: String(match.access_token),
    instagramBusinessAccountId: match.instagram_business_account?.id
      ? String(match.instagram_business_account.id)
      : page.instagramBusinessAccountId,
  };
}

export async function subscribeMetaPageWebhooks(
  pageId: string,
  pageAccessToken: string,
): Promise<void> {
  const url = new URL(`${GRAPH_BASE}/${pageId}/subscribed_apps`);
  url.searchParams.set('subscribed_fields', 'messages,messaging_postbacks,message_reads');
  url.searchParams.set('access_token', pageAccessToken);
  const response = await fetch(url.toString(), { method: 'POST' });
  if (!response.ok) {
    throw new Error(`Meta webhook subscription failed with HTTP ${response.status}`);
  }
}

export async function exchangeMetaLongLivedUserToken(shortLivedToken: string): Promise<MetaUserToken> {
  const url = new URL(`${GRAPH_BASE}/oauth/access_token`);
  url.searchParams.set('grant_type', 'fb_exchange_token');
  url.searchParams.set('client_id', appId());
  url.searchParams.set('client_secret', appSecret());
  url.searchParams.set('fb_exchange_token', shortLivedToken);
  const response = await fetch(url.toString());
  if (!response.ok) {
    return { accessToken: shortLivedToken, expiresAt: new Date(Date.now() + 3600_000).toISOString() };
  }
  const body = await response.json() as { access_token?: string; expires_in?: number };
  return {
    accessToken: body.access_token ?? shortLivedToken,
    expiresAt: new Date(Date.now() + Math.max(0, body.expires_in ?? 3600) * 1000).toISOString(),
  };
}
