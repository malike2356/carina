import { randomBytes } from 'node:crypto';
import type { ChannelName } from './channels/channel-adapter.interface.js';
import type { SessionIdentityState } from './identity-links-types.js';

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
const userSharingPrefs = new Map<string, boolean>();

export function generateLinkCode(params: {
  userId: string;
  channel: ChannelName;
  channelUserId: string;
  displayName?: string;
}): string {
  const code = randomBytes(4).toString('hex');
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
    codes.delete(code);
    return { error: 'Link code expired. Generate a new one on the other channel.' };
  }
  codes.delete(code);
  return { userId: entry.userId };
}

export function setCrossChannelSharing(userId: string, enabled: boolean): void {
  userSharingPrefs.set(userId, enabled);
}

export function getCrossChannelSharing(userId: string): boolean {
  return userSharingPrefs.get(userId) ?? true;
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
