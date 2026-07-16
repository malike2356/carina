import { config } from '../../config/index.js';
import crypto from 'node:crypto';
import {
  formatOAuth1AuthorizationHeader,
  percentEncode,
  signOAuth1Request,
} from '../../gateway/channels/adapters/twitter-oauth.js';

const REQUEST_TOKEN_URL = 'https://api.twitter.com/oauth/request_token';
const AUTHORIZE_URL = 'https://api.twitter.com/oauth/authorize';
const ACCESS_TOKEN_URL = 'https://api.twitter.com/oauth/access_token';

export interface TwitterRequestToken {
  oauthToken: string;
  oauthTokenSecret: string;
  authUrl: string;
}

export interface TwitterUserTokens {
  accessToken: string;
  accessTokenSecret: string;
  userId: string;
  screenName: string;
}

function apiKey(): string {
  return config.socialOAuth.twitter.apiKey;
}

function apiSecret(): string {
  return config.socialOAuth.twitter.apiSecret;
}

export function isTwitterOAuthConfigured(): boolean {
  return Boolean(apiKey() && apiSecret());
}

function parseOAuthResponse(body: string): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(body));
}

export async function getTwitterRequestToken(redirectUri: string): Promise<TwitterRequestToken> {
  if (!isTwitterOAuthConfigured()) {
    throw new Error('Twitter OAuth is not configured on this server');
  }
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: apiKey(),
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_version: '1.0',
    oauth_callback: redirectUri,
  };
  const signatureKey = `${percentEncode(apiSecret())}&`;
  const paramString = Object.keys(oauthParams)
    .sort()
    .map((key) => `${percentEncode(key)}=${percentEncode(oauthParams[key]!)}`)
    .join('&');
  const baseString = ['POST', percentEncode(REQUEST_TOKEN_URL), percentEncode(paramString)].join('&');
  oauthParams.oauth_signature = crypto.createHmac('sha1', signatureKey).update(baseString).digest('base64');

  const response = await fetch(REQUEST_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: formatOAuth1AuthorizationHeader(oauthParams),
    },
  });
  if (!response.ok) {
    throw new Error(`Twitter request token failed with HTTP ${response.status}`);
  }
  const parsed = parseOAuthResponse(await response.text());
  const oauthToken = parsed.oauth_token ?? '';
  const oauthTokenSecret = parsed.oauth_token_secret ?? '';
  if (!oauthToken || !oauthTokenSecret) {
    throw new Error('Twitter request token response missing oauth_token');
  }
  return {
    oauthToken,
    oauthTokenSecret,
    authUrl: `${AUTHORIZE_URL}?oauth_token=${encodeURIComponent(oauthToken)}`,
  };
}

export async function exchangeTwitterAccessToken(
  oauthToken: string,
  oauthVerifier: string,
  oauthTokenSecret: string,
): Promise<TwitterUserTokens> {
  const oauthParams = signOAuth1Request({
    method: 'POST',
    url: ACCESS_TOKEN_URL,
    consumerKey: apiKey(),
    consumerSecret: apiSecret(),
    accessToken: oauthToken,
    accessTokenSecret: oauthTokenSecret,
  });
  oauthParams.oauth_verifier = oauthVerifier;

  const response = await fetch(ACCESS_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: formatOAuth1AuthorizationHeader(oauthParams),
    },
  });
  if (!response.ok) {
    throw new Error(`Twitter access token failed with HTTP ${response.status}`);
  }
  const parsed = parseOAuthResponse(await response.text());
  const accessToken = parsed.oauth_token ?? '';
  const accessTokenSecret = parsed.oauth_token_secret ?? '';
  const userId = parsed.user_id ?? '';
  if (!accessToken || !accessTokenSecret || !userId) {
    throw new Error('Twitter access token response incomplete');
  }
  return {
    accessToken,
    accessTokenSecret,
    userId,
    screenName: parsed.screen_name ?? userId,
  };
}
