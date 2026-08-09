/** Outreach Program (O01/O02): leads, campaigns, sequences, delivery log. */

export const PIPELINE_STATUSES = [
  'new',
  'enriched',
  'ready',
  'contacted',
  'replied',
  'qualified',
  'booked',
  'attended',
  'proposal_sent',
  'won',
  'nurture',
  'lost',
  'ghosted',
  'follow_up',
  'suppressed',
] as const;

export type PipelineStatus = (typeof PIPELINE_STATUSES)[number];

export type LeadSource =
  | 'manual'
  | 'csv_import'
  | 'scrape'
  | 'youtube_comment'
  | 'email'
  | 'referral'
  | 'companies_house'
  | 'import'
  | 'other'
  | 'internet_search'
  | 'company_website'
  | 'property_listing'
  | 'directory'
  | 'google_maps'
  | 'upload'
  | 'google_sheet'
  | 'channel_attachment'
  | 'api'
  | 'agent_research';

/** Rich provenance for spreadsheet-quality lead tracking. */
export type LeadSourceType = LeadSource;

export type ConsentStatus =
  | 'unknown'
  | 'legitimate_interest'
  | 'opted_in'
  | 'opted_out'
  | 'suppressed';

export type LeadPriority = 'low' | 'medium' | 'high' | 'urgent' | string;

export interface LeadProvenance {
  sourceType: LeadSourceType;
  sourceName?: string;
  sourceUrl?: string;
  sourceCapturedAt?: string;
  sourceJobId?: string;
}

export type ReplyState = 'none' | 'awaiting' | 'replied' | 'unsubscribed';
export type BookingState = 'none' | 'offered' | 'booked' | 'attended' | 'no_show';
export type ReplyClassification =
  | 'interested'
  | 'booking_intent'
  | 'question'
  | 'objection'
  | 'not_interested'
  | 'not_now'
  | 'unsubscribe'
  | 'ooo'
  | 'unknown'
  | 'referral'
  | 'bounce'
  | 'complaint'
  | 'uncertain';

export interface LeadTimelineEvent {
  id: string;
  at: string;
  kind: 'status_change' | 'note' | 'enrolled' | 'delivery' | 'stop' | 'import' | 'system' | 'enrichment' | 'merge' | 'conversion';
  message: string;
  fromStatus?: PipelineStatus;
  toStatus?: PipelineStatus;
  meta?: Record<string, string>;
}

export interface OutreachLead {
  id: string;
  workspaceId: string;
  /** Contact / person name (compat: historically `name`). */
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  companyNumber?: string;
  /** Flat source enum kept for older clients. */
  source: LeadSource;
  campaignId?: string;
  status: PipelineStatus;
  owner?: string;
  notes?: string;
  tags: string[];
  timezone?: string;
  lastContactedAt?: string;
  nextActionAt?: string;
  replyState: ReplyState;
  bookingState: BookingState;
  /** Linked duplicate lead ids (dedupe keeps primary; links others). */
  linkedLeadIds: string[];
  youtubeLeadId?: string;
  youtubeChannelId?: string;
  createdAt: string;
  updatedAt: string;
  timeline: LeadTimelineEvent[];

  // Spreadsheet-quality canonical fields (additive)
  niche?: string;
  townCity?: string;
  website?: string;
  contactName?: string;
  googleReviews?: number;
  googleRating?: number;
  googleMapsUrl?: string;
  websiteScore?: number;
  ranksTop3?: boolean | string;
  weakness?: string;
  priority?: LeadPriority;
  dateAdded?: string;
  sourceType?: LeadSourceType;
  sourceName?: string;
  sourceUrl?: string;
  sourceCapturedAt?: string;
  sourceJobId?: string;
  ownerWorkerId?: string;
  listIds?: string[];
  campaignIds?: string[];
  sequenceId?: string;
  pipelineStage?: string;
  lastReplyAt?: string;
  consentStatus?: ConsentStatus;
  suppressionReason?: string;
  customFields?: Record<string, unknown>;
  archivedAt?: string;
  convertedContactId?: string;
  convertedCustomerAt?: string;
  conversionValue?: number;
  /** Optimistic concurrency when loaded from Postgres. */
  version?: number;
}

export type LeadIngestJobKind = 'import' | 'scrape' | 'sheet_sync' | 'api' | 'agent' | 'channel';
export type LeadIngestJobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface LeadIngestRowResult {
  rowIndex: number;
  outcome: 'created' | 'updated' | 'duplicate' | 'rejected' | 'warning';
  leadId?: string;
  reason?: string;
}

export interface LeadIngestJob {
  id: string;
  workspaceId: string;
  kind: LeadIngestJobKind;
  status: LeadIngestJobStatus;
  sourceType: LeadSourceType;
  sourceName?: string;
  sourceUrl?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  created: number;
  updated: number;
  duplicate: number;
  rejected: number;
  warning: number;
  rowResults: LeadIngestRowResult[];
  error?: string;
  meta?: Record<string, string>;
}

export interface CampaignCadence {
  dailyCap: number;
  timezone: string;
  businessHoursStart: string;
  businessHoursEnd: string;
  businessDays: number[];
  weeklyTarget?: number;
  fromEmail?: string;
  requireApproval?: boolean;
  warmupDays?: number;
}

export interface OutreachCampaign {
  id: string;
  workspaceId: string;
  name: string;
  objective: string;
  sourceType: LeadSource | 'mixed';
  targetAudience: string;
  active: boolean;
  cadence: CampaignCadence;
  defaultBookingLink?: string;
  defaultSequenceId?: string;
  createdAt: string;
  updatedAt: string;
}

export type SequenceChannel = 'email' | 'whatsapp' | 'telegram' | 'sms';

export interface SequenceStep {
  id: string;
  order: number;
  label: string;
  channel: SequenceChannel;
  subject: string;
  body: string;
  delayHours: number;
  cta?: string;
  link?: string;
  attachmentNote?: string;
}

export interface OutreachSequence {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  channelDefault: SequenceChannel;
  steps: SequenceStep[];
  stopOnReply: boolean;
  stopOnBooking: boolean;
  stopOnUnsubscribe: boolean;
  createdAt: string;
  updatedAt: string;
}

export type EnrollmentStatus = 'active' | 'paused' | 'completed' | 'stopped';

export type EnrollmentStopReason =
  | 'reply'
  | 'booking'
  | 'unsubscribe'
  | 'manual_pause'
  | 'support_case'
  | 'completed'
  | 'failed';

export interface SequenceEnrollment {
  id: string;
  workspaceId: string;
  leadId: string;
  sequenceId: string;
  campaignId?: string;
  status: EnrollmentStatus;
  stopReason?: EnrollmentStopReason;
  currentStepIndex: number;
  nextActionAt?: string;
  enrolledAt: string;
  updatedAt: string;
}

export type DeliveryEventStatus =
  | 'scheduled'
  | 'queued'
  | 'pending_approval'
  | 'accepted'
  | 'sent'
  | 'deferred'
  | 'delivered'
  | 'opened'
  | 'clicked'
  | 'bounced'
  | 'complained'
  | 'failed'
  | 'replied'
  | 'unsubscribed'
  | 'cancelled'
  | 'skipped';

export interface DeliveryEvent {
  id: string;
  workspaceId: string;
  enrollmentId: string;
  leadId: string;
  sequenceId: string;
  stepId: string;
  stepOrder: number;
  channel: SequenceChannel;
  subject: string;
  body: string;
  status: DeliveryEventStatus;
  scheduledFor: string;
  attempts: number;
  lastError?: string;
  approvalId?: string;
  /** Provider message id (Gmail id, Resend id, etc.). */
  providerMessageId?: string;
  /** Gmail thread id or equivalent conversation id. */
  providerThreadId?: string;
  /** RFC 5322 Message-ID when known. */
  rfcMessageId?: string;
  provider?: string;
  mailboxIdentity?: string;
  openedAt?: string;
  clickedAt?: string;
  openCount?: number;
  clickCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface LeadList {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  leadIds: string[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export type BookingKind = 'discovery' | 'sales' | 'internal_follow_up';
export type BookingStatus = 'confirmed' | 'rescheduled' | 'cancelled' | 'attended' | 'no_show';
export type PostCallOutcome = 'qualified' | 'proposal_needed' | 'needs_follow_up' | 'not_a_fit' | 'won' | 'lost';

export type OutreachBoardStage =
  | 'new'
  | 'contacted'
  | 'replied'
  | 'booked'
  | 'attended'
  | 'won'
  | 'lost'
  | 'nurture';

export type OutreachBoardBackend = 'trello' | 'native';

export interface OutreachBoardConfig {
  workspaceId: string;
  backend: OutreachBoardBackend;
  trelloBoardId?: string;
  trelloListIds?: Partial<Record<OutreachBoardStage, string>>;
  nativeSessionId?: string;
  nativeBoardId?: string;
  enabled: boolean;
  lastSyncedAt?: string;
  lastGrantWarning?: string;
}

export interface OutreachBoardRef {
  leadId: string;
  boardBackend: OutreachBoardBackend;
  boardId: string;
  cardId: string;
  listId?: string;
  stage: OutreachBoardStage;
  updatedAt: string;
}

export interface OutreachAlertTarget {
  workspaceId: string;
  enabled: boolean;
  channel: 'telegram';
  conversationId: string;
  workerId?: string;
  label?: string;
  updatedAt: string;
}

export interface OutreachControlState {
  workspaceId: string;
  paused: boolean;
  updatedAt: string;
  updatedBy?: string;
  reason?: string;
}

export interface FollowUpTask {
  id: string;
  workspaceId: string;
  leadId: string;
  kind:
    | 'cold_no_reply_day_3'
    | 'cold_no_reply_day_7'
    | 'interested_day_1'
    | 'interested_day_3'
    | 'no_show_day_0_evening'
    | 'no_show_day_2'
    | 'owner_day_2_outcome'
    | 'post_call_qualified_next_step'
    | 'post_call_proposal_draft'
    | 'post_call_follow_up'
    | 'post_call_not_a_fit_close'
    | 'post_call_won_onboarding'
    | 'post_call_lost_closeout';
  dueAt: string;
  status: 'scheduled' | 'sent' | 'skipped' | 'cancelled';
  subject: string;
  body: string;
  channel: 'telegram' | 'email';
  conversationId?: string;
  bookingId?: string;
  actionLabel: string;
  skipReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OutreachBooking {
  id: string;
  workspaceId: string;
  leadId: string;
  campaignId?: string;
  kind: BookingKind;
  status: BookingStatus;
  startsAt: string;
  endsAt: string;
  timezone: string;
  attendeeEmail?: string;
  attendeeName?: string;
  hostEmail?: string;
  hostName?: string;
  calendarProvider: 'google' | 'local';
  calendarEventId?: string;
  joinLink?: string;
  confirmationSubject: string;
  confirmationBody: string;
  confirmationStatus: 'pending_approval' | 'sent' | 'skipped';
  postCallOutcome?: PostCallOutcome;
  postCallNotes?: string;
  reminderIds: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type ReminderKind = '24h' | '1h' | 'custom' | 'operator_alert';
export type ReminderStatus = 'scheduled' | 'sent' | 'skipped' | 'cancelled';

export interface OutreachReminder {
  id: string;
  workspaceId: string;
  bookingId: string;
  leadId: string;
  kind: ReminderKind;
  templateKey: BookingKind;
  dueAt: string;
  status: ReminderStatus;
  subject: string;
  body: string;
  operatorAlert?: boolean;
  skipReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LeadSheetConfig {
  id: string;
  workspaceId: string;
  name: string;
  kind: 'workspace_csv' | 'google_sheet';
  relativePath?: string;
  googleSpreadsheetId?: string;
  googleSheetUrl?: string;
  documentId?: string;
  lastSyncAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OutreachStoreShape {
  leads: OutreachLead[];
  campaigns: OutreachCampaign[];
  sequences: OutreachSequence[];
  enrollments: SequenceEnrollment[];
  deliveries: DeliveryEvent[];
  lists: LeadList[];
  replyReviews: ReplyReview[];
  bookings: OutreachBooking[];
  reminders: OutreachReminder[];
  bookingConfigs: Record<string, BookingConfig>;
  boardConfigs: Record<string, OutreachBoardConfig>;
  boardRefs: Record<string, OutreachBoardRef>;
  alertTargets: Record<string, OutreachAlertTarget>;
  controls: Record<string, OutreachControlState>;
  followUpTasks: FollowUpTask[];
  /** Linked CRM lead spreadsheet handles (workspace CSV and/or Google Sheets). */
  leadSheetConfigs: Record<string, LeadSheetConfig>;
  /** Import / scrape job audit history. */
  ingestJobs: LeadIngestJob[];
  /** Saved CRM table views per workspace. */
  leadViews: LeadSavedView[];
  /** Workspace email suppression list. */
  suppressions?: Array<{
    workspaceId: string;
    email: string;
    reason: 'unsubscribe' | 'complaint' | 'hard_bounce' | 'manual' | 'opted_out' | 'policy';
    leadId?: string;
    note?: string;
    createdAt: string;
    updatedAt?: string;
  }>;
}

export interface LeadSavedView {
  id: string;
  workspaceId: string;
  name: string;
  ownerUserId?: string;
  shared?: boolean;
  sharedWith?: string[];
  filters: Record<string, string | string[] | boolean | undefined>;
  columns?: string[];
  columnOrder?: string[];
  columnWidths?: Record<string, number>;
  hiddenColumns?: string[];
  sort?: { field: string; dir: 'asc' | 'desc' };
  density?: 'compact' | 'comfortable' | 'spacious';
  createdAt: string;
  updatedAt: string;
}

export interface ReplyReview {
  id: string;
  workspaceId: string;
  leadId: string | null;
  fingerprint: string;
  fromEmail: string;
  subject: string;
  bodyPreview: string;
  classification: ReplyClassification;
  confidence: number;
  status: 'open' | 'resolved';
  sourceMessageId?: string;
  inReplyTo?: string;
  threadId?: string;
  matchedLeadId?: string | null;
  deliveryId?: string | null;
  matchMethod?: string;
  matchConfidence?: number;
  actionTaken?: 'reply' | 'booking' | 'nurture' | 'unsubscribe' | 'manual_review' | 'ignored';
  suggestedReply?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BookingWindow {
  dayOfWeek: number;
  start: string;
  end: string;
}

export interface BookingConfig {
  timezone: string;
  slotMinutes: number;
  bufferMinutes: number;
  horizonDays: number;
  reminderOffsetsMinutes: number[];
  windows: BookingWindow[];
  blockedDates: string[];
  meetingMode: 'google_meet' | 'zoom';
  zoomRoomUrl?: string;
  prepVideoUrl?: string;
  prepVideoTitle?: string;
  prepVideoPassword?: string;
}
