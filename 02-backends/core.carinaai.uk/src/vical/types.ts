/**
 * viCal (Verlox Integrated Calendar) for Carina / Hire Aiva.
 * Behavioural source: propreneur/propreneur-v2 app/Services/Vcal (do not copy PHP).
 * P0 store is file-backed (like outreach); Cloud Postgres tables land in parallel for prompt 01/08 cutover.
 */

export const VCAL_BOOKING_STATUSES = [
  'pending_payment',
  'pending_review',
  'confirmed',
  'cancelled',
  'rejected',
] as const;

export type VcalBookingStatus = (typeof VCAL_BOOKING_STATUSES)[number];

export const VCAL_SESSION_OUTCOMES = ['attended', 'no_show'] as const;
export type VcalSessionOutcome = (typeof VCAL_SESSION_OUTCOMES)[number];

export const VCAL_BOOKING_SOURCES = ['public', 'api', 'agent', 'outreach'] as const;
export type VcalBookingSource = (typeof VCAL_BOOKING_SOURCES)[number];

export type VcalLocationMode =
  | 'google_meet'
  | 'zoom'
  | 'teams'
  | 'phone'
  | 'in_person'
  | 'none';

export type VcalIntakeQuestionType = 'text' | 'select' | 'number';

export interface VcalIntakeQuestion {
  key: string;
  label: string;
  type: VcalIntakeQuestionType;
  required?: boolean;
  choices?: string[];
  disqualifyValues?: string[];
  disqualifyMessage?: string;
}

export interface VcalIntakeRoutingRule {
  match: Record<string, string>;
  routeToEventTypeId: string;
  priority?: number;
  label?: string;
}

export interface VcalIntakePool {
  id: string;
  workspaceId: string;
  hostUserId: string;
  name: string;
  slug: string;
  questions: VcalIntakeQuestion[];
  routingRules: VcalIntakeRoutingRule[];
  createdAt: string;
  updatedAt: string;
}

export interface VcalEventType {
  id: string;
  workspaceId: string;
  hostUserId: string;
  slug: string;
  name: string;
  durationMinutes: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  minNoticeMinutes: number;
  horizonDays: number;
  locationMode: VcalLocationMode;
  requiresApproval: boolean;
  requiresDeposit: boolean;
  depositMinor: number | null;
  depositCurrency: string | null;
  intakePoolId: string | null;
  active: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface VcalAvailabilityRule {
  id: string;
  workspaceId: string;
  hostUserId: string;
  eventTypeId: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  timezone: string;
  createdAt: string;
  updatedAt: string;
}

export interface VcalBlackoutDate {
  id: string;
  workspaceId: string;
  hostUserId: string | null;
  startsOn: string;
  endsOn: string;
  reason?: string;
  createdAt: string;
  updatedAt: string;
}

export type VcalCalendarSyncStatus = 'pending' | 'synced' | 'failed' | 'skipped';

/** Concierge orchestration overlay (Prompt 703); legacy status remains for existing paths. */
export const VCAL_ORCHESTRATION_STATUSES = [
  'held',
  'pending_confirmation',
  'provisioning',
  'confirmed',
  'action_required',
  'rescheduling',
  'cancelled',
  'completed',
  'no_show',
] as const;

export type VcalOrchestrationStatus = (typeof VCAL_ORCHESTRATION_STATUSES)[number];

export type VcalProviderOpStatus =
  | 'pending'
  | 'succeeded'
  | 'failed'
  | 'retryable'
  | 'action_required'
  | 'compensated'
  | 'duplicate';

export interface VcalAvailabilityHold {
  id: string;
  workspaceId: string;
  hostUserId: string;
  eventTypeId: string;
  startsAt: string;
  endsAt: string;
  holderToken: string;
  expiresAt: string;
  bookingIntentId?: string;
  createdAt: string;
}

export interface VcalBookingIntent {
  id: string;
  workspaceId: string;
  workerId?: string;
  eventTypeId: string;
  idempotencyKey: string;
  guestName: string;
  guestEmail: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  status: 'open' | 'committed' | 'expired' | 'cancelled';
  holdId?: string;
  bookingId?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface VcalBookingParticipant {
  id: string;
  workspaceId: string;
  bookingId: string;
  role: 'host' | 'guest' | 'observer';
  email: string;
  name?: string;
  /** Contract DeliveryState (+ UI aliases invitation_sent / delivery_failed mapped in helpers). */
  deliveryState?: VcalDeliveryState;
  responseStatus?: VcalAttendeeResponseStatus;
  createdAt: string;
  updatedAt?: string;
}

export type VcalDeliveryState =
  | 'pending'
  | 'sent'
  | 'delivered'
  | 'accepted'
  | 'declined'
  | 'failed'
  | 'unknown';

export type VcalAttendeeResponseStatus =
  | 'needsAction'
  | 'accepted'
  | 'declined'
  | 'tentative';

export interface VcalCalendarProjectionAttendee {
  email: string;
  responseStatus: VcalAttendeeResponseStatus;
  deliveryState: VcalDeliveryState;
}

export interface VcalCalendarProjection {
  id: string;
  workspaceId: string;
  bookingId: string;
  provider: 'google' | 'microsoft' | 'none';
  providerEventId: string | null;
  etag?: string | null;
  htmlLink?: string | null;
  organizerEmail?: string | null;
  attendees: VcalCalendarProjectionAttendee[];
  invitationSendRequested: boolean;
  lastReconciledAt?: string | null;
  syncError?: string | null;
  watchChannelId?: string | null;
  watchResourceId?: string | null;
  watchExpiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VcalDeliveryAttempt {
  id: string;
  workspaceId: string;
  bookingId: string;
  participantId?: string | null;
  channel: 'google_invitation' | 'microsoft_invitation' | 'email_ics' | 'sms';
  state: VcalDeliveryState;
  providerMessageId?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  attemptedAt: string;
}

export interface VcalCalendarWatchChannel {
  id: string;
  workspaceId: string;
  workerId: string;
  provider: 'google' | 'microsoft';
  channelId: string;
  resourceId: string;
  resourceUri?: string | null;
  token: string;
  expiration: string;
  syncToken?: string | null;
  bookingId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VcalConferenceArtifact {
  id: string;
  workspaceId: string;
  bookingId: string;
  provider: 'zoom' | 'static_url' | 'google_meet' | 'none';
  providerMeetingId: string | null;
  joinUrl: string | null;
  /** Encrypted-at-rest optional; never returned on public DTOs. */
  hostStartUrlEnc?: string | null;
  hostStartUrlPresent: boolean;
  passcodeRequired: boolean;
  waitingRoom: boolean;
  managed: boolean;
  fallbackLabel?: string;
  createdAt: string;
  updatedAt: string;
}

export interface VcalProviderOperation {
  id: string;
  workspaceId: string;
  bookingId: string;
  provider: string;
  action: string;
  idempotencyKey: string;
  status: VcalProviderOpStatus;
  attempt: number;
  providerResourceId?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VcalWebhookReceipt {
  id: string;
  workspaceId?: string;
  provider: string;
  eventId: string;
  eventType: string;
  receivedAt: string;
  processedAt?: string;
  status: 'received' | 'processed' | 'duplicate' | 'rejected';
  payloadSafe: Record<string, unknown>;
}

export interface VcalBooking {
  id: string;
  workspaceId: string;
  eventTypeId: string;
  hostUserId: string;
  guestName: string;
  guestEmail: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  status: VcalBookingStatus;
  guestToken: string;
  meetingUrl?: string;
  calendarEventId?: string;
  calendarProvider?: 'google' | 'microsoft' | 'none';
  calendarSyncStatus?: VcalCalendarSyncStatus;
  calendarSyncError?: string;
  contactId?: string;
  leadId?: string;
  source: VcalBookingSource;
  intakeAnswers?: Record<string, unknown>;
  notes?: string;
  sessionOutcome?: VcalSessionOutcome;
  cancelReason?: string;
  previousStartsAt?: string;
  previousEndsAt?: string;
  /** Prompt 703: durable duplicate suppression across entry points. */
  idempotencyKey?: string;
  orchestrationStatus?: VcalOrchestrationStatus;
  actionRequiredReason?: string;
  conferenceArtifactId?: string;
  /** Prompt 704: guest invitation delivery summary for UI. */
  invitationDeliveryState?: VcalDeliveryState;
  calendarProjectionId?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface VcalSlotLock {
  id: string;
  workspaceId: string;
  hostUserId: string;
  startsAt: string;
  endsAt: string;
  holderToken: string;
  expiresAt: string;
  createdAt: string;
}

export interface VcalBusyWindow {
  start: string;
  end: string;
}

export interface VcalOfferedSlot {
  start: string;
  end: string;
  timezone: string;
}

export interface VcalPublishProfile {
  workspaceId: string;
  publicSlug: string;
  hostUserId: string;
  updatedAt: string;
}

export type VcalReminderKind = '24h' | '1h' | 'custom' | 'operator_alert';
export type VcalReminderStatus = 'scheduled' | 'sent' | 'cancelled' | 'failed';

export interface VcalReminder {
  id: string;
  workspaceId: string;
  bookingId: string;
  kind: VcalReminderKind;
  offsetMinutes: number;
  dueAt: string;
  status: VcalReminderStatus;
  subject: string;
  body: string;
  skipReason?: string;
  sentAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface VcalStoreShape {
  eventTypes: VcalEventType[];
  intakePools: VcalIntakePool[];
  availabilityRules: VcalAvailabilityRule[];
  blackouts: VcalBlackoutDate[];
  bookings: VcalBooking[];
  slotLocks: VcalSlotLock[];
  publishProfiles: Record<string, VcalPublishProfile>;
  reminders: VcalReminder[];
  availabilityHolds: VcalAvailabilityHold[];
  bookingIntents: VcalBookingIntent[];
  participants: VcalBookingParticipant[];
  conferenceArtifacts: VcalConferenceArtifact[];
  providerOperations: VcalProviderOperation[];
  webhookReceipts: VcalWebhookReceipt[];
  calendarProjections: VcalCalendarProjection[];
  deliveryAttempts: VcalDeliveryAttempt[];
  calendarWatchChannels: VcalCalendarWatchChannel[];
}

export type VcalDomainHook =
  | { type: 'booking.created'; booking: VcalBooking }
  | { type: 'booking.confirmed'; booking: VcalBooking }
  | { type: 'booking.cancelled'; booking: VcalBooking }
  | { type: 'booking.rejected'; booking: VcalBooking }
  | {
      type: 'booking.rescheduled';
      booking: VcalBooking;
      previousStartsAt: string;
      previousEndsAt: string;
    }
  | { type: 'booking.outcome'; booking: VcalBooking };

export type VcalHookListener = (hook: VcalDomainHook) => void;
