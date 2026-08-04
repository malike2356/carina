import { loadJsonStore, saveJsonStore } from '../../lib/property-channel-store.js';
import { decryptCredentials, encryptCredentials } from '../../channels/credential-store.js';
import type { YouTubeStoredTokenRecord, YouTubeTokenSet } from './types.js';

const STORE_FILE = 'youtube-tokens.json';

function emptyStore(): YouTubeStoredTokenRecord[] {
  return [];
}

function recordKey(workspaceId: string, channelId: string): string {
  return `${workspaceId}:${channelId}`;
}

export function saveYouTubeTokens(
  workspaceId: string,
  channelId: string,
  tokens: YouTubeTokenSet,
): YouTubeStoredTokenRecord {
  const store = loadJsonStore<YouTubeStoredTokenRecord[]>(STORE_FILE, emptyStore);
  const encrypted = encryptCredentials({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  });
  const record: YouTubeStoredTokenRecord = {
    workspaceId,
    channelId,
    encrypted,
    expiresAt: tokens.expiresAt,
    scope: tokens.scope,
    updatedAt: new Date().toISOString(),
  };
  const idx = store.findIndex(
    (r) => recordKey(r.workspaceId, r.channelId) === recordKey(workspaceId, channelId),
  );
  if (idx >= 0) store[idx] = record;
  else store.push(record);
  saveJsonStore(STORE_FILE, store);
  return record;
}

export function getYouTubeTokens(
  workspaceId: string,
  channelId: string,
): YouTubeTokenSet | null {
  const store = loadJsonStore<YouTubeStoredTokenRecord[]>(STORE_FILE, emptyStore);
  const record = store.find(
    (r) => recordKey(r.workspaceId, r.channelId) === recordKey(workspaceId, channelId),
  );
  if (!record) return null;
  const decrypted = decryptCredentials(record.encrypted);
  return {
    accessToken: decrypted.accessToken ?? '',
    refreshToken: decrypted.refreshToken ?? '',
    expiresAt: record.expiresAt,
    scope: record.scope,
  };
}

export function updateYouTubeAccessToken(
  workspaceId: string,
  channelId: string,
  accessToken: string,
  expiresAt: number,
): void {
  const existing = getYouTubeTokens(workspaceId, channelId);
  if (!existing) return;
  saveYouTubeTokens(workspaceId, channelId, { ...existing, accessToken, expiresAt });
}

export function deleteYouTubeTokens(workspaceId: string, channelId: string): boolean {
  const store = loadJsonStore<YouTubeStoredTokenRecord[]>(STORE_FILE, emptyStore);
  const before = store.length;
  const next = store.filter(
    (r) => recordKey(r.workspaceId, r.channelId) !== recordKey(workspaceId, channelId),
  );
  if (next.length === before) return false;
  saveJsonStore(STORE_FILE, next);
  return true;
}

export function listConnectedChannels(workspaceId: string): YouTubeStoredTokenRecord[] {
  const store = loadJsonStore<YouTubeStoredTokenRecord[]>(STORE_FILE, emptyStore);
  return store.filter((r) => r.workspaceId === workspaceId);
}

export function isTokenExpiringSoon(tokens: YouTubeTokenSet, bufferMs = 5 * 60 * 1000): boolean {
  return Date.now() + bufferMs >= tokens.expiresAt;
}
