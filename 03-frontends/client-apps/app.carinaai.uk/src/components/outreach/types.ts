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
  | 'follow_up'
  | 'enriched'
  | 'ready'
  | 'qualified'
  | 'nurture'
  | 'suppressed';

export type OutreachLead = {
  id: string;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  company?: string;
  niche?: string;
  townCity?: string;
  website?: string;
  googleReviews?: number;
  googleRating?: number;
  googleMapsUrl?: string;
  websiteScore?: number;
  ranksTop3?: boolean | string;
  weakness?: string;
  priority?: string;
  dateAdded?: string;
  source: string;
  sourceType?: string;
  sourceName?: string;
  sourceUrl?: string;
  sourceCapturedAt?: string;
  sourceJobId?: string;
  campaignId?: string;
  campaignIds?: string[];
  listIds?: string[];
  sequenceId?: string;
  pipelineStage?: string;
  status: PipelineStatus;
  owner?: string;
  ownerWorkerId?: string;
  notes?: string;
  tags: string[];
  replyState: string;
  bookingState: string;
  nextActionAt?: string;
  lastContactedAt?: string;
  lastReplyAt?: string;
  consentStatus?: string;
  suppressionReason?: string;
  customFields?: Record<string, unknown>;
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

export const PIPELINE_LABELS: Record<string, string> = {
  new: 'New Lead',
  enriched: 'Enriched',
  ready: 'Ready for Outreach',
  contacted: 'Contacted',
  replied: 'Replied',
  qualified: 'Qualified',
  booked: 'Appointment Booked',
  attended: 'Attended',
  proposal_sent: 'Proposal',
  won: 'Customer',
  nurture: 'Nurture',
  lost: 'Closed Lost',
  ghosted: 'Ghosted',
  follow_up: 'Follow-up',
  suppressed: 'Suppressed',
};

export const CRM_DEFAULT_COLUMNS = [
  { id: 'company', label: 'Company', sticky: true },
  { id: 'contactName', label: 'Contact Name', sticky: true },
  { id: 'niche', label: 'Niche' },
  { id: 'townCity', label: 'Town/City' },
  { id: 'website', label: 'Website' },
  { id: 'email', label: 'Email' },
  { id: 'phone', label: 'Phone' },
  { id: 'googleReviews', label: 'Google Reviews' },
  { id: 'googleRating', label: 'Google Rating' },
  { id: 'googleMapsUrl', label: 'Google Maps URL' },
  { id: 'websiteScore', label: 'Website Score' },
  { id: 'ranksTop3', label: 'Ranks Top3?' },
  { id: 'weakness', label: 'Weakness' },
  { id: 'priority', label: 'Priority' },
  { id: 'status', label: 'Status' },
  { id: 'dateAdded', label: 'Date Added' },
  { id: 'notes', label: 'Notes' },
  { id: 'sourceType', label: 'Source' },
  { id: 'sourceUrl', label: 'Source URL' },
  { id: 'pipelineStage', label: 'Pipeline Stage' },
  { id: 'lastContactedAt', label: 'Last Contact' },
  { id: 'lastReplyAt', label: 'Last Reply' },
  { id: 'nextActionAt', label: 'Next Action' },
  { id: 'ownerWorkerId', label: 'Owner Worker' },
] as const;
