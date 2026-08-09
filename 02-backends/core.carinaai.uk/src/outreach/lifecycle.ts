/** Lead → contact/customer conversion and next-best-action suggestions. */

import crypto from 'crypto';
import { appendTimeline, transitionLeadStatus } from './pipeline.js';
import { getLead } from './leads.js';
import { mutateOutreachStore } from './store.js';
import type { OutreachLead, PipelineStatus } from './types.js';

function nowIso(): string {
  return new Date().toISOString();
}

export function convertLeadToContact(workspaceId: string, leadId: string): OutreachLead | null {
  const lead = getLead(workspaceId, leadId);
  if (!lead) return null;
  const contactId = lead.convertedContactId || crypto.randomUUID();
  let next = appendTimeline(lead, {
    kind: 'conversion',
    message: 'Lead converted to durable contact identity',
    meta: { contactId },
  });
  next = {
    ...next,
    convertedContactId: contactId,
    updatedAt: nowIso(),
  };
  if (next.status === 'new' || next.status === 'enriched' || next.status === 'ready') {
    next = transitionLeadStatus(next, 'qualified', 'Converted to contact');
  }
  mutateOutreachStore((store) => {
    const idx = store.leads.findIndex((row) => row.id === leadId && row.workspaceId === workspaceId);
    if (idx >= 0) store.leads[idx] = next;
  });
  return next;
}

export function markLeadAsCustomer(
  workspaceId: string,
  leadId: string,
  opts?: { value?: number; note?: string },
): OutreachLead | null {
  const existing = getLead(workspaceId, leadId);
  if (!existing) return null;
  if (!existing.convertedContactId) {
    convertLeadToContact(workspaceId, leadId);
  }
  const lead = getLead(workspaceId, leadId);
  if (!lead) return null;
  const stamp = nowIso();
  let next = transitionLeadStatus(lead, 'won', opts?.note || 'Marked as customer');
  next = appendTimeline(next, {
    kind: 'conversion',
    message: opts?.note || 'Customer conversion recorded',
    meta: {
      value: opts?.value != null ? String(opts.value) : '',
      source: next.sourceType || next.source,
      campaignId: next.campaignId || '',
      sequenceId: next.sequenceId || '',
    },
  });
  next = {
    ...next,
    convertedCustomerAt: stamp,
    conversionValue: opts?.value,
    updatedAt: stamp,
  };
  mutateOutreachStore((store) => {
    const idx = store.leads.findIndex((row) => row.id === leadId && row.workspaceId === workspaceId);
    if (idx >= 0) store.leads[idx] = next;
  });
  return next;
}

export function suggestNextBestAction(lead: OutreachLead): {
  action: string;
  explanation: string;
  confidence: number;
  suggestedStatus?: PipelineStatus;
} {
  if (lead.status === 'suppressed' || lead.replyState === 'unsubscribed') {
    return {
      action: 'leave_suppressed',
      explanation: 'Lead is suppressed or unsubscribed; do not contact.',
      confidence: 0.99,
    };
  }
  if (!lead.email && !lead.phone) {
    return {
      action: 'enrich_contact',
      explanation: 'Missing email and phone; enrich before outreach.',
      confidence: 0.92,
      suggestedStatus: 'enriched',
    };
  }
  if (lead.status === 'new') {
    return {
      action: 'enrich_then_ready',
      explanation: 'New lead should be enriched, then moved to Ready for Outreach.',
      confidence: 0.88,
      suggestedStatus: 'enriched',
    };
  }
  if (lead.status === 'enriched' || lead.status === 'ready') {
    return {
      action: 'enrol_sequence',
      explanation: 'Lead is ready; enrol in an approved sequence after Soft Wall approval.',
      confidence: 0.86,
      suggestedStatus: 'ready',
    };
  }
  if (lead.status === 'contacted' && lead.replyState === 'awaiting') {
    return {
      action: 'wait_or_follow_up',
      explanation: 'Awaiting reply; schedule a follow-up if the delay window has passed.',
      confidence: 0.8,
      suggestedStatus: 'follow_up',
    };
  }
  if (lead.status === 'replied' || lead.status === 'qualified') {
    return {
      action: 'offer_booking',
      explanation: 'Reply received; offer a discovery booking link.',
      confidence: 0.9,
      suggestedStatus: 'booked',
    };
  }
  if (lead.status === 'booked' || lead.status === 'attended') {
    return {
      action: 'send_proposal',
      explanation: 'Appointment completed or booked; prepare a proposal.',
      confidence: 0.84,
      suggestedStatus: 'proposal_sent',
    };
  }
  if (lead.status === 'won') {
    return {
      action: 'nurture',
      explanation: 'Customer won; move into nurture for retention touchpoints.',
      confidence: 0.82,
      suggestedStatus: 'nurture',
    };
  }
  return {
    action: 'review_manually',
    explanation: 'No strong automatic next step; review the timeline.',
    confidence: 0.55,
  };
}
