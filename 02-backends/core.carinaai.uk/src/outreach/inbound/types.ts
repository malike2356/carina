/** Normalized inbound mail shared by Gmail, IMAP, and hosted webhooks. */

export type InboundMailProvider =
  | 'gmail'
  | 'imap'
  | 'mailgun'
  | 'cloudflare'
  | 'resend'
  | 'manual'
  | 'test';

export interface NormalizedInboundAttachment {
  filename: string;
  contentType?: string;
  sizeBytes?: number;
  providerAttachmentId?: string;
}

export interface NormalizedInboundMessage {
  workspaceId: string;
  workerId?: string;
  provider: InboundMailProvider;
  providerMessageId: string;
  threadId?: string;
  inReplyTo?: string;
  references?: string[];
  from: string;
  to: string[];
  cc?: string[];
  subject: string;
  textBody: string;
  htmlSafeMeta?: { hasHtml: boolean; truncated?: boolean };
  receivedAt: string;
  attachments?: NormalizedInboundAttachment[];
  /** SHA-256 hex of stable provider payload fields. */
  checksum: string;
  rawHeaders?: Record<string, string>;
}

export type MatchMethod =
  | 'provider_thread'
  | 'in_reply_to'
  | 'references'
  | 'correlation_token'
  | 'mailbox_sender_recent'
  | 'scored_fallback'
  | 'unmatched'
  | 'ambiguous';

export interface InboundMatchResult {
  method: MatchMethod;
  confidence: number;
  leadId: string | null;
  deliveryId: string | null;
  enrollmentId: string | null;
  campaignId: string | null;
  sequenceId: string | null;
  requiresReview: boolean;
  reason: string;
}
