export interface IdentityLink {
  id: string;
  userId: string;
  channel: string;
  channelUserId: string;
  displayName: string | null;
  linkedAt: number;
  lastSeenAt: number;
  isPrimary: boolean;
  metadata: Record<string, unknown>;
}

export const IDENTITY_LINKS_MIGRATION = `
CREATE TABLE IF NOT EXISTS identity_links (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  channel_user_id TEXT NOT NULL,
  display_name TEXT,
  linked_at BIGINT NOT NULL,
  last_seen_at BIGINT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE(channel, channel_user_id),
  UNIQUE(user_id, channel)
);
CREATE INDEX IF NOT EXISTS idx_il_user ON identity_links(user_id);
CREATE INDEX IF NOT EXISTS idx_il_channel_user ON identity_links(channel, channel_user_id);
`;

export type SessionIdentityState = {
  canonicalUserId: string;
  crossChannelSharing: boolean;
  replyChannel: string;
  replyConversationId: string;
  replyThreadId?: string;
  originChannel?: string;
  dockedFrom?: string;
  dockedAt?: number;
};
