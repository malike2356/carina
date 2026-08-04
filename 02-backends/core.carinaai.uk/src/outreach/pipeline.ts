import crypto from 'crypto';
import { PIPELINE_STATUSES, type LeadTimelineEvent, type OutreachLead, type PipelineStatus } from './types.js';

export function isPipelineStatus(value: string): value is PipelineStatus {
  return (PIPELINE_STATUSES as readonly string[]).includes(value);
}

export function appendTimeline(
  lead: OutreachLead,
  event: Omit<LeadTimelineEvent, 'id' | 'at'> & { at?: string },
): OutreachLead {
  const entry: LeadTimelineEvent = {
    id: crypto.randomUUID(),
    at: event.at ?? new Date().toISOString(),
    kind: event.kind,
    message: event.message,
    fromStatus: event.fromStatus,
    toStatus: event.toStatus,
    meta: event.meta,
  };
  return {
    ...lead,
    timeline: [...lead.timeline, entry],
    updatedAt: entry.at,
  };
}

export function transitionLeadStatus(
  lead: OutreachLead,
  toStatus: PipelineStatus,
  message?: string,
): OutreachLead {
  if (lead.status === toStatus) return lead;
  const fromStatus = lead.status;
  let next = appendTimeline(lead, {
    kind: 'status_change',
    message: message ?? `Status moved from ${fromStatus} to ${toStatus}`,
    fromStatus,
    toStatus,
  });
  next = { ...next, status: toStatus };

  if (toStatus === 'contacted' && !next.lastContactedAt) {
    next = { ...next, lastContactedAt: next.updatedAt };
  }
  if (toStatus === 'replied') {
    next = { ...next, replyState: 'replied' };
  }
  if (toStatus === 'booked') {
    next = { ...next, bookingState: 'booked' };
  }
  if (toStatus === 'attended') {
    next = { ...next, bookingState: 'attended' };
  }
  return next;
}
