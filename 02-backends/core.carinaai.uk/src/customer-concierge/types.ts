/**
 * Customer Concierge v1 TypeScript types (Prompt 700).
 * Aligned with contracts/customer-concierge-v1/schemas/*.schema.json.
 * Keprix must vendor the JSON schemas; do not import this module from Keprix.
 */

export const CUSTOMER_CONCIERGE_CONTRACT_VERSION = '1.0.0' as const;

export type ConciergeActorType = 'audience' | 'operator' | 'system' | 'provider';

export type BookingState =
  | 'held'
  | 'pending_confirmation'
  | 'provisioning'
  | 'confirmed'
  | 'action_required'
  | 'rescheduling'
  | 'cancelled'
  | 'completed'
  | 'no_show';

export type DeliveryState =
  | 'pending'
  | 'sent'
  | 'delivered'
  | 'accepted'
  | 'declined'
  | 'failed'
  | 'unknown';

export type ConciergeEventType =
  | 'conversation.started'
  | 'contact.matched'
  | 'consent.changed'
  | 'booking.held'
  | 'booking.confirmed'
  | 'invitation.sent'
  | 'attendee.response_changed'
  | 'booking.rescheduled'
  | 'booking.cancelled'
  | 'reminder.sent'
  | 'support_case.opened'
  | 'handoff.requested'
  | 'conversation.closed';

export type ProviderName =
  | 'google_calendar'
  | 'microsoft_calendar'
  | 'zoom'
  | 'email'
  | 'sms';

export type ProviderResultStatus =
  | 'succeeded'
  | 'failed'
  | 'retryable'
  | 'action_required'
  | 'not_configured'
  | 'duplicate';

export type FeatureReadinessStatus =
  | 'ready'
  | 'not_configured'
  | 'disconnected'
  | 'error'
  | 'disabled';

export type ConciergeFeatureKey =
  | 'publicConcierge'
  | 'zoom'
  | 'googleCalendar'
  | 'microsoftCalendar'
  | 'emailDelivery'
  | 'inboundWebhookReconciliation';

export interface ConciergeEventEnvelope {
  contractVersion: typeof CUSTOMER_CONCIERGE_CONTRACT_VERSION;
  eventId: string;
  eventType: ConciergeEventType;
  occurredAt: string;
  workspaceId: string;
  conciergeId: string;
  correlationId: string;
  causationId: string;
  actorType: ConciergeActorType;
  actorId?: string | null;
  payload: Record<string, unknown>;
}

export interface AudienceIdentity {
  id: string;
  workspaceId: string;
  channel: 'web' | 'telegram' | 'whatsapp' | 'email' | 'sms' | 'voice';
  actorType: 'audience';
  externalKey: string;
  displayName?: string | null;
  email?: string | null;
  phone?: string | null;
  crmContactId?: string | null;
}

export interface AudienceSession {
  id: string;
  workspaceId: string;
  conciergeId: string;
  identityId: string;
  actorType: 'audience';
  channel: 'web' | 'telegram' | 'whatsapp' | 'email' | 'sms' | 'voice';
  status: 'active' | 'handed_off' | 'closed';
  consentRecordId?: string | null;
  startedAt?: string;
}

export interface ConciergeBooking {
  id: string;
  workspaceId: string;
  conciergeId: string;
  meetingTypeId: string;
  status: BookingState;
  startsAt: string;
  endsAt: string;
  timezone: string;
  actorType: ConciergeActorType;
  guestEmail?: string | null;
  joinUrl?: string | null;
  idempotencyKey?: string | null;
}

export interface ProviderCommand {
  contractVersion: typeof CUSTOMER_CONCIERGE_CONTRACT_VERSION;
  commandId: string;
  provider: ProviderName;
  action:
    | 'create_event'
    | 'update_event'
    | 'cancel_event'
    | 'create_meeting'
    | 'update_meeting'
    | 'cancel_meeting'
    | 'send_message'
    | 'reconcile_webhook';
  workspaceId: string;
  conciergeId?: string | null;
  actorType: ConciergeActorType;
  idempotencyKey: string;
  payload?: Record<string, unknown>;
}

export interface ProviderResult {
  contractVersion: typeof CUSTOMER_CONCIERGE_CONTRACT_VERSION;
  commandId: string;
  provider: ProviderName;
  workspaceId: string;
  actorType: ConciergeActorType;
  ok: boolean;
  status: ProviderResultStatus;
  providerResourceId?: string | null;
  joinUrl?: string | null;
  deliveryState?: DeliveryState | null;
  errorCode?: string | null;
  errorMessage?: string | null;
}

export interface FeatureStatus {
  key: ConciergeFeatureKey;
  enabled: boolean;
  status: FeatureReadinessStatus;
  detail?: string | null;
}

export interface ConciergeReadinessReport {
  contractVersion: typeof CUSTOMER_CONCIERGE_CONTRACT_VERSION;
  workspaceId: string;
  conciergeId: string | null;
  ready: boolean;
  features: Record<ConciergeFeatureKey, FeatureStatus>;
  blockers: string[];
}

export interface StateTransition {
  contractVersion: typeof CUSTOMER_CONCIERGE_CONTRACT_VERSION;
  machine: 'booking' | 'delivery' | 'support_case' | 'audience_session';
  from: string;
  to: string;
  workspaceId: string;
  actorType: ConciergeActorType;
  entityId?: string;
  reason?: string | null;
}
