export type AivaChannelName =
  | 'whatsapp'
  | 'email'
  | 'slack'
  | 'telegram'
  | 'web'
  | 'sms'
  | 'voice'
  | 'discord'
  | 'teams'
  | 'linkedin'
  | 'instagram'
  | 'messenger'
  | 'twitter'
  | 'tiktok';

export interface InboundMessage {
  channel: AivaChannelName;
  workerId: string;
  workspaceId: string;
  contactId: string;
  contactName?: string;
  conversationId?: string;
  content: string;
  rawPayload: unknown;
  timestamp: Date;
  threadId?: string;
  attachments?: Array<{ type: string; url: string; name?: string }>;
  /** Channel-specific hints (e.g. preferAudio=true for Telegram voice replies). */
  metadata?: Record<string, string>;
}

export interface OutboundMessage {
  channel: AivaChannelName;
  contactId: string;
  content: string;
  replyToThreadId?: string;
  metadata?: Record<string, string>;
}

export interface ChannelAdapter {
  channel: AivaChannelName;
  verify(headers: Record<string, string>, rawBody: Buffer, credentials?: Record<string, string>): boolean;
  parse(payload: unknown, workerId: string, workspaceId: string): InboundMessage | null;
  send(message: OutboundMessage, credentials: Record<string, string>): Promise<void>;
}

export interface WorkerChannelRow {
  id: string;
  workerId: string;
  workspaceId: string;
  channel: AivaChannelName;
  identifier: string;
  credentials: { encrypted?: string };
  enabled: boolean;
  verified: boolean;
  createdAt: Date;
  updatedAt: Date;
}
