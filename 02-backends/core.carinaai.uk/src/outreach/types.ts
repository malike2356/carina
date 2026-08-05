/** Outreach Program (O01/O02): leads, campaigns, sequences, delivery log. */

export const PIPELINE_STATUSES = [
  'new',
  'contacted',
  'replied',
  'booked',
  'attended',
  'proposal_sent',
  'won',
  'lost',
  'ghosted',
  'follow_up',
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
  | 'other';

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
  | 'unknown';

export interface LeadTimelineEvent {
  id: string;
  at: string;
  kind: 'status_change' | 'note' | 'enrolled' | 'delivery' | 'stop' | 'import' | 'system';
  message: string;
  fromStatus?: PipelineStatus;
  toStatus?: PipelineStatus;
  meta?: Record<string, string>;
}

export interface OutreachLead {
  id: string;
  workspaceId: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  companyNumber?: string;
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
  | 'pending_approval'
  | 'sent'
  | 'delivered'
  | 'bounced'
  | 'failed'
  | 'replied'
  | 'unsubscribed'
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
