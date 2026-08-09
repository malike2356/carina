/**
 * Unified CRM timeline for Customer Concierge (Prompt 705).
 * Merges lead timeline, support case events, concierge durable events, and booking evidence.
 */

import { getLead, listLeads, getCampaign } from '../outreach/leads.js';
import { listEnrollments, getSequence } from '../outreach/sequence-engine.js';
import { listBookings, getBooking } from '../vical/bookings.js';
import { getConferenceArtifact } from '../vical/saga/ledger.js';
import { getCalendarProjection } from '../vical/calendar/projection-store.js';
import { bookingInvitationView } from '../vical/calendar/reconcile.js';
import { listCaseEvents, listSupportCases } from './support-cases.js';
import { listConciergeEvents } from './events.js';

export type CrmTimelineItem = {
  id: string;
  at: string;
  source:
    | 'lead'
    | 'support_case'
    | 'concierge_event'
    | 'booking'
    | 'enrollment'
    | 'conference'
    | 'calendar';
  kind: string;
  title: string;
  summary: string;
  links: Record<string, string | null>;
  meta: Record<string, unknown>;
};

export type CrmTimelineBundle = {
  identity: {
    email: string | null;
    leadId: string | null;
    contactName: string | null;
    company: string | null;
    source: string | null;
    campaignId: string | null;
    campaignName: string | null;
    tags: string[];
  };
  enrollments: Array<Record<string, unknown>>;
  bookings: Array<Record<string, unknown>>;
  supportCases: Array<Record<string, unknown>>;
  items: CrmTimelineItem[];
  leadTableFilters: {
    statuses: string[];
    sources: string[];
    bookingStates: string[];
    replyStates: string[];
    hasOpenSupportCase: boolean;
    hasActiveEnrollment: boolean;
  };
};

function findLeadByEmail(workspaceId: string, email: string) {
  const needle = email.trim().toLowerCase();
  return listLeads(workspaceId).find((l) => (l.email ?? '').toLowerCase() === needle) ?? null;
}

export async function buildCrmTimeline(input: {
  workspaceId: string;
  workerId: string;
  leadId?: string | null;
  email?: string | null;
  audienceSessionId?: string | null;
  bookingId?: string | null;
  limit?: number;
}): Promise<CrmTimelineBundle> {
  const limit = Math.max(1, Math.min(200, input.limit ?? 80));
  let lead = input.leadId ? getLead(input.workspaceId, input.leadId) : null;
  if (!lead && input.email) {
    lead = findLeadByEmail(input.workspaceId, input.email);
  }

  const email = (lead?.email ?? input.email ?? null)?.toLowerCase() ?? null;
  const campaign = lead?.campaignId ? getCampaign(input.workspaceId, lead.campaignId) : null;
  const enrollments = lead
    ? listEnrollments(input.workspaceId, { leadId: lead.id })
    : [];

  const bookings = listBookings(input.workspaceId)
    .filter((b) => {
      if (input.bookingId) return b.id === input.bookingId;
      if (lead?.id && b.leadId === lead.id) return true;
      if (email && b.guestEmail.toLowerCase() === email) return true;
      return false;
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const cases = await listSupportCases({
    workspaceId: input.workspaceId,
    workerId: input.workerId,
    limit: 100,
  }).catch(() => []);
  const supportCases = cases.filter((c) => {
    if (input.audienceSessionId && c.audienceSessionId === input.audienceSessionId) return true;
    if (lead?.id && c.contactId === lead.id) return true;
    if (email && String(c.metadata?.guestEmail ?? '').toLowerCase() === email) return true;
    return false;
  });

  const scopedCases =
    supportCases.length > 0
      ? supportCases
      : input.audienceSessionId
        ? cases.filter((c) => c.audienceSessionId === input.audienceSessionId)
        : [];

  const items: CrmTimelineItem[] = [];

  if (lead) {
    for (const ev of lead.timeline ?? []) {
      items.push({
        id: `lead:${ev.id}`,
        at: ev.at,
        source: 'lead',
        kind: ev.kind,
        title: ev.kind.replace(/_/g, ' '),
        summary: ev.message,
        links: { leadId: lead.id, campaignId: lead.campaignId ?? null },
        meta: ev.meta ?? {},
      });
    }
  }

  for (const enrollment of enrollments) {
    const sequence = getSequence(input.workspaceId, enrollment.sequenceId);
    items.push({
      id: `enrollment:${enrollment.id}`,
      at: enrollment.updatedAt,
      source: 'enrollment',
      kind: enrollment.status,
      title: `Sequence ${enrollment.status}`,
      summary: `${sequence?.name ?? enrollment.sequenceId}${enrollment.stopReason ? ` (${enrollment.stopReason})` : ''}`,
      links: {
        enrollmentId: enrollment.id,
        sequenceId: enrollment.sequenceId,
        leadId: enrollment.leadId,
      },
      meta: {
        stopReason: enrollment.stopReason ?? null,
        currentStepIndex: enrollment.currentStepIndex,
        nextActionAt: enrollment.nextActionAt ?? null,
      },
    });
  }

  for (const booking of bookings) {
    const invitation = bookingInvitationView(booking);
    const conference = getConferenceArtifact(input.workspaceId, booking.id);
    const projection = getCalendarProjection(input.workspaceId, booking.id);
    items.push({
      id: `booking:${booking.id}`,
      at: booking.updatedAt,
      source: 'booking',
      kind: booking.status,
      title: `Booking ${booking.status}`,
      summary: `${booking.guestName} · ${booking.startsAt}`,
      links: {
        bookingId: booking.id,
        leadId: booking.leadId ?? lead?.id ?? null,
        calendarEventId: booking.calendarEventId ?? projection?.providerEventId ?? null,
        conferenceId: conference?.id ?? null,
      },
      meta: {
        invitationDeliveryState: invitation.invitationDeliveryState,
        invitationUiLabel: invitation.invitationUiLabel,
        sessionOutcome: booking.sessionOutcome ?? null,
        orchestrationStatus: booking.orchestrationStatus ?? null,
        meetingUrl: booking.meetingUrl ?? null,
        conferenceManaged: conference?.managed ?? null,
        conferenceProvider: conference?.provider ?? null,
      },
    });
    if (conference) {
      items.push({
        id: `conference:${conference.id}`,
        at: conference.updatedAt ?? booking.updatedAt,
        source: 'conference',
        kind: conference.provider,
        title: `Conference (${conference.provider})`,
        summary: conference.managed ? 'Managed meeting' : 'Static/fallback join',
        links: {
          bookingId: booking.id,
          conferenceId: conference.id,
          joinUrl: conference.joinUrl ?? null,
        },
        meta: {
          managed: conference.managed,
          providerMeetingId: conference.providerMeetingId ?? null,
          hostStartUrlPresent: conference.hostStartUrlPresent ?? false,
        },
      });
    }
    if (projection) {
      items.push({
        id: `calendar:${projection.id}`,
        at: projection.updatedAt ?? booking.updatedAt,
        source: 'calendar',
        kind: booking.invitationDeliveryState ?? 'unknown',
        title: 'Calendar invitation',
        summary: `Delivery ${booking.invitationDeliveryState ?? 'unknown'}`,
        links: {
          bookingId: booking.id,
          calendarEventId: projection.providerEventId ?? null,
        },
        meta: {
          provider: projection.provider,
          deliveryState: booking.invitationDeliveryState ?? null,
          invitationSendRequested: projection.invitationSendRequested,
        },
      });
    }
  }

  for (const supportCase of scopedCases) {
    items.push({
      id: `case:${supportCase.id}:opened`,
      at: supportCase.createdAt,
      source: 'support_case',
      kind: 'opened',
      title: 'Support case opened',
      summary: supportCase.subject,
      links: {
        caseId: supportCase.id,
        audienceSessionId: supportCase.audienceSessionId,
      },
      meta: {
        status: supportCase.status,
        priority: supportCase.priority,
      },
    });
    const events = await listCaseEvents({
      workspaceId: input.workspaceId,
      caseId: supportCase.id,
    }).catch(() => []);
    for (const ev of events) {
      items.push({
        id: `case-event:${ev.id}`,
        at: ev.createdAt,
        source: 'support_case',
        kind: ev.eventType,
        title: ev.eventType.replace(/_/g, ' '),
        summary: ev.detail ?? supportCase.subject,
        links: {
          caseId: supportCase.id,
          audienceSessionId: supportCase.audienceSessionId,
        },
        meta: {
          actorType: ev.actorType,
          payload: ev.payload,
        },
      });
    }
  }

  const conciergeEvents = listConciergeEvents({
    workspaceId: input.workspaceId,
    workerId: input.workerId,
    limit: 100,
  }).filter((e) => {
    const p = e.payload;
    if (lead?.id && p.leadId === lead.id) return true;
    if (email && String(p.guestEmail ?? p.email ?? '').toLowerCase() === email) return true;
    if (input.audienceSessionId && p.audienceSessionId === input.audienceSessionId) return true;
    if (input.bookingId && p.bookingId === input.bookingId) return true;
    return false;
  });

  for (const e of conciergeEvents) {
    items.push({
      id: `ce:${e.id}`,
      at: e.occurredAt,
      source: 'concierge_event',
      kind: e.eventType,
      title: e.eventType.replace(/\./g, ' '),
      summary: String(e.payload.summary ?? e.eventType),
      links: {
        leadId: (e.payload.leadId as string | undefined) ?? lead?.id ?? null,
        bookingId: (e.payload.bookingId as string | undefined) ?? null,
        caseId: (e.payload.caseId as string | undefined) ?? null,
        audienceSessionId: (e.payload.audienceSessionId as string | undefined) ?? null,
      },
      meta: e.payload,
    });
  }

  items.sort((a, b) => b.at.localeCompare(a.at));

  const openCase = scopedCases.some((c) => c.status !== 'closed' && c.status !== 'resolved');
  return {
    identity: {
      email,
      leadId: lead?.id ?? null,
      contactName: lead?.name ?? lead?.contactName ?? null,
      company: lead?.company ?? null,
      source: lead?.source ?? null,
      campaignId: lead?.campaignId ?? null,
      campaignName: campaign?.name ?? null,
      tags: lead?.tags ?? [],
    },
    enrollments: enrollments.map((e) => ({
      id: e.id,
      status: e.status,
      stopReason: e.stopReason ?? null,
      sequenceId: e.sequenceId,
      sequenceName: getSequence(input.workspaceId, e.sequenceId)?.name ?? null,
      currentStepIndex: e.currentStepIndex,
      nextActionAt: e.nextActionAt ?? null,
      updatedAt: e.updatedAt,
    })),
    bookings: bookings.map((b) => {
      const invitation = bookingInvitationView(b);
      const conference = getConferenceArtifact(input.workspaceId, b.id);
      return {
        id: b.id,
        status: b.status,
        startsAt: b.startsAt,
        endsAt: b.endsAt,
        meetingUrl: b.meetingUrl ?? null,
        calendarEventId: b.calendarEventId ?? null,
        leadId: b.leadId ?? null,
        sessionOutcome: b.sessionOutcome ?? null,
        ...invitation,
        conferenceManaged: conference?.managed ?? null,
        conferenceProvider: conference?.provider ?? null,
      };
    }),
    supportCases: scopedCases.map((c) => ({
      id: c.id,
      status: c.status,
      priority: c.priority,
      subject: c.subject,
      audienceSessionId: c.audienceSessionId,
      slaFirstResponseAt: c.slaFirstResponseAt,
      slaResolutionAt: c.slaResolutionAt,
      firstRespondedAt: c.firstRespondedAt,
      resolvedAt: c.resolvedAt,
    })),
    items: items.slice(0, limit),
    leadTableFilters: {
      statuses: lead ? [lead.status] : [],
      sources: lead?.source ? [lead.source] : [],
      bookingStates: lead?.bookingState ? [lead.bookingState] : [],
      replyStates: lead?.replyState ? [lead.replyState] : [],
      hasOpenSupportCase: openCase,
      hasActiveEnrollment: enrollments.some((e) => e.status === 'active' || e.status === 'paused'),
    },
  };
}

export function getBookingEvidence(workspaceId: string, bookingId: string) {
  const booking = getBooking(workspaceId, bookingId);
  if (!booking) return null;
  return {
    booking,
    invitation: bookingInvitationView(booking),
    conference: getConferenceArtifact(workspaceId, bookingId),
    calendarProjection: getCalendarProjection(workspaceId, bookingId),
    links: {
      outreachBookings: '/aiva/outreach/bookings',
      vicalBookings: '/vical/bookings',
      pipeline: '/aiva/outreach/pipeline',
    },
  };
}
