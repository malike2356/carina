import { randomBytes } from 'node:crypto';
import type { ChannelName } from './channels/channel-adapter.interface.js';
import type { SessionIdentityState } from './identity-links-types.js';
import { getIdentityResolver, identityLinksEnabled } from './identity-resolver.js';
import { isDatabaseConfigured } from '../config/database-url.js';
import { pool } from '../memory/db.js';

const CODE_TTL_MS = 5 * 60 * 1000;

type LinkCode = {
  code: string;
  userId: string;
  channel: ChannelName;
  channelUserId: string;
  displayName?: string;
  expiresAt: number;
};

const codes = new Map<string, LinkCode>();
const sessionById = new Map<string, SessionIdentityState>();
/** In-memory cache; DB is source of truth when configured. */
const userSharingPrefs = new Map<string, boolean>();
let sharingSchemaReady: Promise<void> | null = null;

async function ensureSharingPrefsSchema(): Promise<void> {
  if (!isDatabaseConfigured()) return;
  if (!sharingSchemaReady) {
    sharingSchemaReady = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS identity_sharing_prefs (
          user_id TEXT PRIMARY KEY,
          cross_channel_sharing BOOLEAN NOT NULL DEFAULT true,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
    })().catch((err) => {
      sharingSchemaReady = null;
      throw err;
    });
  }
  await sharingSchemaReady;
}

export function generateLinkCode(params: {
  userId: string;
  channel: ChannelName;
  channelUserId: string;
  displayName?: string;
}): string {
  const code = randomBytes(4).toString('hex').toLowerCase();
  codes.set(code, {
    code,
    userId: params.userId,
    channel: params.channel,
    channelUserId: params.channelUserId,
    displayName: params.displayName,
    expiresAt: Date.now() + CODE_TTL_MS,
  });
  return code;
}

export function claimLinkCode(
  code: string,
  target: { channel: ChannelName; channelUserId: string; displayName?: string },
): { userId: string } | { error: string } {
  const entry = codes.get(code.trim().toLowerCase());
  if (!entry) return { error: 'Invalid or expired link code.' };
  if (Date.now() > entry.expiresAt) {
    codes.delete(entry.code);
    return { error: 'Link code expired. Generate a new one on the other channel.' };
  }
  codes.delete(entry.code);
  return { userId: entry.userId };
}

export function setCrossChannelSharing(userId: string, enabled: boolean): void {
  userSharingPrefs.set(userId, enabled);
  if (isDatabaseConfigured()) {
    void ensureSharingPrefsSchema()
      .then(() => pool.query(
        `INSERT INTO identity_sharing_prefs (user_id, cross_channel_sharing, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (user_id) DO UPDATE SET
           cross_channel_sharing = EXCLUDED.cross_channel_sharing,
           updated_at = NOW()`,
        [userId, enabled],
      ))
      .catch(() => undefined);
  }
}

export function getCrossChannelSharing(userId: string): boolean {
  if (userSharingPrefs.has(userId)) {
    return userSharingPrefs.get(userId) ?? true;
  }
  return true;
}

/** Load share prefs from DB into memory (call on session ensure when possible). */
export async function loadCrossChannelSharing(userId: string): Promise<boolean> {
  if (userSharingPrefs.has(userId)) {
    return userSharingPrefs.get(userId) ?? true;
  }
  if (!isDatabaseConfigured()) return true;
  try {
    await ensureSharingPrefsSchema();
    const { rows } = await pool.query<{ cross_channel_sharing: boolean }>(
      `SELECT cross_channel_sharing FROM identity_sharing_prefs WHERE user_id = $1`,
      [userId],
    );
    if (rows[0]) {
      const enabled = Boolean(rows[0].cross_channel_sharing);
      userSharingPrefs.set(userId, enabled);
      return enabled;
    }
  } catch {
    /* fall through to default */
  }
  return true;
}

export function getSessionIdentityState(sessionId: string): SessionIdentityState | undefined {
  return sessionById.get(sessionId);
}

export function ensureSessionIdentity(
  sessionId: string,
  canonicalUserId: string,
  inbound: {
    channel: ChannelName;
    conversationId: string;
    threadId?: string;
  },
): SessionIdentityState {
  const existing = sessionById.get(sessionId);
  if (existing) {
    if (!existing.dockedFrom) {
      existing.replyChannel = inbound.channel;
      existing.replyConversationId = inbound.conversationId;
      existing.replyThreadId = inbound.threadId;
    }
    existing.crossChannelSharing = getCrossChannelSharing(canonicalUserId);
    return existing;
  }
  const state: SessionIdentityState = {
    canonicalUserId,
    crossChannelSharing: getCrossChannelSharing(canonicalUserId),
    replyChannel: inbound.channel,
    replyConversationId: inbound.conversationId,
    replyThreadId: inbound.threadId,
    originChannel: inbound.channel,
  };
  sessionById.set(sessionId, state);
  // Warm share pref from DB without blocking inbound path.
  void loadCrossChannelSharing(canonicalUserId).then((enabled) => {
    const current = sessionById.get(sessionId);
    if (current) current.crossChannelSharing = enabled;
  });
  return state;
}

export function updateSessionDocking(
  sessionId: string,
  patch: Partial<Pick<SessionIdentityState, 'replyChannel' | 'replyConversationId' | 'replyThreadId' | 'dockedFrom' | 'dockedAt'>>,
): SessionIdentityState | undefined {
  const state = sessionById.get(sessionId);
  if (!state) return undefined;
  Object.assign(state, patch);
  if (patch.dockedFrom === undefined && !('dockedFrom' in patch)) {
    // undock clears dockedFrom via explicit undefined check in undock()
  }
  return state;
}

export function clearSessionIdentity(sessionId: string): void {
  sessionById.delete(sessionId);
}

export function clearSessionIdentityForTests(): void {
  sessionById.clear();
  codes.clear();
  userSharingPrefs.clear();
  sharingSchemaReady = null;
}

export async function buildLinkedSessionExternalKey(
  canonicalUserId: string,
  inboundChannel: ChannelName,
  inboundExternalKey: string,
): Promise<string> {
  if (!getCrossChannelSharing(canonicalUserId)) {
    return inboundExternalKey;
  }
  return `canonical:${canonicalUserId}`;
}

export function formatLinkedIdentitiesBlock(
  identities: Array<{ channel: string; displayName: string | null; channelUserId: string }>,
  replyChannel: string,
  docking?: { originChannel?: string; dockedFrom?: string },
): string {
  if (identities.length <= 1 && !docking?.dockedFrom) return '';
  const lines = ['', '## Linked Identities', ''];
  if (identities.length > 0) {
    lines.push('You are talking to the same person across these channels:');
    for (const id of identities) {
      const label = id.displayName ?? id.channelUserId;
      lines.push(`- ${id.channel} (${label})`);
    }
    lines.push('');
  }
  lines.push(`Currently replying on: ${replyChannel}`);
  if (docking?.originChannel && docking.originChannel !== replyChannel) {
    lines.push(`Session started on: ${docking.originChannel}`);
  }
  if (docking?.dockedFrom) {
    lines.push('Use /dock back to return replies to the original channel.');
  }
  lines.push('');
  return lines.join('\n');
}

export async function buildLinkedIdentitiesSection(sessionId: string): Promise<string> {
  if (!identityLinksEnabled()) return '';
  const state = getSessionIdentityState(sessionId);
  if (!state) return '';
  const identities = await getIdentityResolver().getIdentities(state.canonicalUserId);
  return formatLinkedIdentitiesBlock(
    identities.map((row) => ({
      channel: row.channel,
      displayName: row.displayName,
      channelUserId: row.channelUserId,
    })),
    state.replyChannel,
    { originChannel: state.originChannel, dockedFrom: state.dockedFrom },
  );
}
