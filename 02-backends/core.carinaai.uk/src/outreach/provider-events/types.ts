/** Normalized provider delivery / engagement events. */

export type ProviderEventKind =
  | 'accepted'
  | 'sent'
  | 'delivered'
  | 'deferred'
  | 'soft_bounce'
  | 'hard_bounce'
  | 'complaint'
  | 'unsubscribe'
  | 'opened'
  | 'clicked'
  | 'replied'
  | 'failed';

export type ProviderEventProcessingStatus =
  | 'applied'
  | 'ignored'
  | 'rejected'
  | 'duplicate';

export interface NormalizedProviderEvent {
  provider: string;
  providerEventId: string;
  workspaceId?: string;
  mailboxIdentity?: string;
  providerMessageId?: string;
  deliveryId?: string;
  kind: ProviderEventKind;
  occurredAt: string;
  receivedAt: string;
  checksum: string;
  payload: Record<string, unknown>;
}

export interface ApplyProviderEventResult {
  ok: boolean;
  duplicate: boolean;
  rejected: boolean;
  reason?: string;
  eventId: string;
  deliveryId?: string | null;
  statusBefore?: string;
  statusAfter?: string;
}
