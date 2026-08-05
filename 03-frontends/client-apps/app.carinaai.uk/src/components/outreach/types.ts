export type PipelineStatus =
  | 'new'
  | 'contacted'
  | 'replied'
  | 'booked'
  | 'attended'
  | 'proposal_sent'
  | 'won'
  | 'lost'
  | 'ghosted'
  | 'follow_up';

export type OutreachLead = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  source: string;
  campaignId?: string;
  status: PipelineStatus;
  owner?: string;
  notes?: string;
  tags: string[];
  replyState: string;
  bookingState: string;
  nextActionAt?: string;
  youtubeLeadId?: string;
  createdAt: string;
  updatedAt: string;
  timeline: Array<{
    id: string;
    at: string;
    kind: string;
    message: string;
    fromStatus?: string;
    toStatus?: string;
  }>;
};

export type OutreachCampaign = {
  id: string;
  name: string;
  objective: string;
  targetAudience: string;
  active: boolean;
  cadence: {
    dailyCap: number;
    timezone: string;
    businessHoursStart: string;
    businessHoursEnd: string;
    businessDays?: number[];
    weeklyTarget?: number;
    fromEmail?: string;
    requireApproval?: boolean;
    warmupDays?: number;
  };
  defaultSequenceId?: string;
  defaultBookingLink?: string;
  sourceType?: string;
  updatedAt?: string;
};

export type OutreachSequence = {
  id: string;
  name: string;
  description?: string;
  channelDefault?: string;
  steps: Array<{
    id: string;
    order: number;
    label: string;
    channel: string;
    subject: string;
    body: string;
    delayHours: number;
    cta?: string;
    link?: string;
    attachmentNote?: string;
  }>;
  stopOnReply: boolean;
  stopOnBooking: boolean;
  stopOnUnsubscribe: boolean;
  updatedAt?: string;
};

export type DeliveryEvent = {
  id: string;
  leadId: string;
  subject: string;
  body: string;
  status: string;
  channel: string;
  scheduledFor: string;
  stepOrder: number;
};

export type LeadList = {
  id: string;
  name: string;
  description?: string;
  leadIds: string[];
  tags: string[];
  updatedAt?: string;
};

export const PIPELINE_LABELS: Record<PipelineStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  replied: 'Replied',
  booked: 'Booked',
  attended: 'Attended',
  proposal_sent: 'Proposal',
  won: 'Won',
  lost: 'Lost',
  ghosted: 'Ghosted',
  follow_up: 'Follow-up',
};
