import { refreshYouTubeAccessToken } from './auth.js';
import { assertQuota, recordUsage } from './quota.js';
import { getYouTubeTokens, isTokenExpiringSoon, updateYouTubeAccessToken } from './token-store.js';
import type { YouTubeQuotaOperation } from './types.js';

const DATA_API_BASE = 'https://www.googleapis.com/youtube/v3';
const UPLOAD_API_BASE = 'https://www.googleapis.com/upload/youtube/v3';
const ANALYTICS_API_BASE = 'https://youtubeanalytics.googleapis.com/v2';

export class YouTubeNotConnectedError extends Error {
  constructor(workspaceId: string, channelId: string) {
    super(`No YouTube OAuth tokens stored for workspace ${workspaceId} channel ${channelId}`);
    this.name = 'YouTubeNotConnectedError';
  }
}

export interface YouTubeRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  headers?: Record<string, string>;
  /** Skip quota accounting, e.g. for local test doubles. */
  skipQuota?: boolean;
}

export interface YouTubeClient {
  workspaceId: string;
  channelId: string;
  /** Authenticated fetch against the YouTube Data API v3. */
  request<T>(path: string, operation: YouTubeQuotaOperation, options?: YouTubeRequestOptions): Promise<T>;
  /** Authenticated fetch against the resumable upload endpoint. */
  requestUpload<T>(path: string, operation: YouTubeQuotaOperation, options: YouTubeRequestOptions & { rawBody: BodyInit }): Promise<T>;
  /** Authenticated fetch against the YouTube Analytics API v2. */
  requestAnalytics<T>(path: string, options?: YouTubeRequestOptions): Promise<T>;
  getAccessToken(): Promise<string>;
}

async function resolveFreshAccessToken(workspaceId: string, channelId: string): Promise<string> {
  const tokens = getYouTubeTokens(workspaceId, channelId);
  if (!tokens) throw new YouTubeNotConnectedError(workspaceId, channelId);
  if (!isTokenExpiringSoon(tokens)) return tokens.accessToken;
  const refreshed = await refreshYouTubeAccessToken(tokens.refreshToken);
  updateYouTubeAccessToken(workspaceId, channelId, refreshed.accessToken, refreshed.expiresAt);
  return refreshed.accessToken;
}

function buildUrl(base: string, path: string, query?: Record<string, string | number | undefined>): string {
  const url = new URL(`${base}${path.startsWith('/') ? path : `/${path}`}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

async function doFetch(
  url: string,
  accessToken: string,
  options?: YouTubeRequestOptions,
  rawBody?: BodyInit,
): Promise<Response> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    ...(options?.headers ?? {}),
  };
  let body: BodyInit | undefined = rawBody;
  if (rawBody === undefined && options?.body !== undefined) {
    headers['Content-Type'] = headers['Content-Type'] ?? 'application/json';
    body = JSON.stringify(options.body);
  }
  return fetch(url, { method: options?.method ?? 'GET', headers, body });
}

/** Creates a per-workspace/channel authenticated YouTube API client with refresh + quota tracking. */
export function createYouTubeClient(workspaceId: string, channelId: string): YouTubeClient {
  async function requestOnce<T>(
    base: string,
    path: string,
    options?: YouTubeRequestOptions,
    rawBody?: BodyInit,
  ): Promise<{ response: Response; accessToken: string }> {
    const accessToken = await resolveFreshAccessToken(workspaceId, channelId);
    const url = buildUrl(base, path, options?.query);
    const response = await doFetch(url, accessToken, options, rawBody);
    return { response, accessToken };
  }

  async function requestWithRetry<T>(
    base: string,
    path: string,
    operation: YouTubeQuotaOperation,
    options?: YouTubeRequestOptions,
    rawBody?: BodyInit,
  ): Promise<T> {
    if (!options?.skipQuota) assertQuota(channelId, operation);

    let { response } = await requestOnce<T>(base, path, options, rawBody);
    if (response.status === 401) {
      const tokens = getYouTubeTokens(workspaceId, channelId);
      if (!tokens) throw new YouTubeNotConnectedError(workspaceId, channelId);
      const refreshed = await refreshYouTubeAccessToken(tokens.refreshToken);
      updateYouTubeAccessToken(workspaceId, channelId, refreshed.accessToken, refreshed.expiresAt);
      ({ response } = await requestOnce<T>(base, path, options, rawBody));
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`YouTube API ${operation} failed with HTTP ${response.status}: ${text.slice(0, 500)}`);
    }

    if (!options?.skipQuota) recordUsage(channelId, operation);

    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) return (await response.json()) as T;
    return (await response.text()) as unknown as T;
  }

  return {
    workspaceId,
    channelId,
    request: (path, operation, options) => requestWithRetry(DATA_API_BASE, path, operation, options),
    requestUpload: (path, operation, options) =>
      requestWithRetry(UPLOAD_API_BASE, path, operation, options, options.rawBody),
    requestAnalytics: (path, options) =>
      requestWithRetry(ANALYTICS_API_BASE, path, 'reports.query', options),
    getAccessToken: () => resolveFreshAccessToken(workspaceId, channelId),
  };
}
