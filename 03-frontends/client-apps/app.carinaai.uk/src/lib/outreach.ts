import type {
  OutreachChannel,
  OutreachLeadStage,
  OutreachTimelineKind,
} from '@/db/schema';

export type OutreachReplyClass = 'unsubscribe' | 'booking' | 'interest' | 'negative' | 'question' | 'neutral';

const UNSUBSCRIBE_RE = /\b(unsubscribe|opt out|opt-out|remove me|stop|do not contact|dont contact)\b/i;
const BOOKING_RE = /\b(book|booking|book a call|call me|meeting|schedule|calendar|zoom|meet)\b/i;
const INTEREST_RE = /\b(interested|sounds good|yes please|keen|let's do it|lets do it|tell me more|happy to)\b/i;
const NEGATIVE_RE = /\b(not interested|no thanks|not now|later|busy|leave me alone)\b/i;

export function classifyOutreachReply(message: string): OutreachReplyClass {
  const text = message.trim();
  if (!text) return 'neutral';
  if (UNSUBSCRIBE_RE.test(text)) return 'unsubscribe';
  if (BOOKING_RE.test(text)) return 'booking';
  if (INTEREST_RE.test(text)) return 'interest';
  if (NEGATIVE_RE.test(text)) return 'negative';
  if (text.includes('?')) return 'question';
  return 'neutral';
}

export function leadStageFromReply(replyClass: OutreachReplyClass): OutreachLeadStage {
  switch (replyClass) {
    case 'unsubscribe':
      return 'unsubscribed';
    case 'booking':
      return 'booked';
    case 'interest':
      return 'replied';
    case 'negative':
      return 'lost';
    case 'question':
      return 'nurturing';
    default:
      return 'contacted';
  }
}

export function replyDirection(replyClass: OutreachReplyClass): 'outbound' | 'inbound' {
  return replyClass === 'neutral' ? 'inbound' : 'inbound';
}

export function replyTimelineKind(replyClass: OutreachReplyClass): OutreachTimelineKind {
  if (replyClass === 'booking') return 'booking_created';
  if (replyClass === 'unsubscribe') return 'status_changed';
  return 'reply_received';
}

export function defaultLeadStageForChannel(channel: OutreachChannel): OutreachLeadStage {
  return channel === 'manual' ? 'queued' : 'prospect';
}

export function extractReplySummary(message: string): string {
  return message.trim().replace(/\s+/g, ' ').slice(0, 180);
}

export function buildTimelineTitle(kind: OutreachTimelineKind, name: string): string {
  switch (kind) {
    case 'campaign_created':
      return `Campaign created: ${name}`;
    case 'campaign_updated':
      return `Campaign updated: ${name}`;
    case 'lead_imported':
      return `Lead added: ${name}`;
    case 'message_sent':
      return `Message sent to ${name}`;
    case 'reply_received':
      return `Reply received from ${name}`;
    case 'booking_created':
      return `Booking created for ${name}`;
    case 'reminder_created':
      return `Reminder scheduled for ${name}`;
    case 'status_changed':
      return `Status updated for ${name}`;
    case 'handoff_created':
      return `Handoff created for ${name}`;
    case 'note_added':
      return `Note added for ${name}`;
    default:
      return name;
  }
}

export function formatLeadContactChannel(channel: OutreachChannel, email?: string | null, phone?: string | null): string {
  if (channel === 'phone' && phone) return phone;
  if (email) return email;
  if (phone) return phone;
  return channel;
}
