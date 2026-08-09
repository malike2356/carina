/**
 * Concierge ↔ outreach automation hooks (Prompt 705).
 * Deterministic, audited, operator-reversible cadence changes.
 */

import { listLeads, getLead, updateLead } from '../outreach/leads.js';
import { appendTimeline } from '../outreach/pipeline.js';
import {
  listEnrollments,
  recordLeadBooking,
  stopEnrollment,
  resumeEnrollment,
  getSequence,
} from '../outreach/sequence-engine.js';
import { loadOutreachStore, mutateOutreachStore } from '../outreach/store.js';
import { appendConciergeEvent } from './events.js';
import type { SequenceEnrollment } from '../outreach/types.js';

export type BookingCancelPolicy = 'keep_stopped' | 'resume_booking_stops';

function findLeadByEmail(workspaceId: string, email: string) {
  const needle = email.trim().toLowerCase();
  return listLeads(workspaceId).find((l) => (l.email ?? '').toLowerCase() === needle) ?? null;
}

export function resolveOutreachLeadId(input: {
  workspaceId: string;
  leadId?: string | null;
  guestEmail?: string | null;
}): string | null {
  if (input.leadId) {
    const lead = getLead(input.workspaceId, input.leadId);
    if (lead) return lead.id;
  }
  if (input.guestEmail) {
    return findLeadByEmail(input.workspaceId, input.guestEmail)?.id ?? null;
  }
  return null;
}

export function pauseOutreachForSupportCase(input: {
  workspaceId: string;
  workerId: string;
  caseId: string;
  leadId?: string | null;
  guestEmail?: string | null;
  audienceSessionId?: string | null;
}): SequenceEnrollment[] {
  const leadId = resolveOutreachLeadId(input);
  if (!leadId) {
    appendConciergeEvent({
      eventType: 'support_case.opened',
      workspaceId: input.workspaceId,
      workerId: input.workerId,
      actorType: 'system',
      payload: {
        caseId: input.caseId,
        audienceSessionId: input.audienceSessionId ?? null,
        summary: 'Support case opened; no matching outreach lead',
      },
    });
    return [];
  }

  const paused: SequenceEnrollment[] = [];
  const active = listEnrollments(input.workspaceId, { leadId, status: 'active' });
  for (const enrollment of active) {
    const next = stopEnrollment(input.workspaceId, enrollment.id, 'support_case');
    if (next) paused.push(next);
  }

  mutateOutreachStore((s) => {
    const idx = s.leads.findIndex((l) => l.id === leadId);
    if (idx >= 0) {
      s.leads[idx] = appendTimeline(s.leads[idx]!, {
        kind: 'stop',
        message: 'Outreach paused for open support case',
        meta: { caseId: input.caseId, reason: 'support_case' },
      });
    }
  });

  appendConciergeEvent({
    eventType: 'support_case.opened',
    workspaceId: input.workspaceId,
    workerId: input.workerId,
    actorType: 'system',
    payload: {
      caseId: input.caseId,
      leadId,
      audienceSessionId: input.audienceSessionId ?? null,
      pausedEnrollmentIds: paused.map((e) => e.id),
      summary: `Paused ${paused.length} enrollment(s) for support case`,
    },
  });

  return paused;
}

export function onBookingConfirmed(input: {
  workspaceId: string;
  workerId: string;
  bookingId: string;
  leadId?: string | null;
  guestEmail?: string | null;
  correlationId?: string | null;
}): void {
  const leadId = resolveOutreachLeadId(input);
  if (leadId) {
    recordLeadBooking(input.workspaceId, leadId);
  }
  appendConciergeEvent({
    eventType: 'booking.confirmed',
    workspaceId: input.workspaceId,
    workerId: input.workerId,
    actorType: 'system',
    correlationId: input.correlationId,
    payload: {
      bookingId: input.bookingId,
      leadId,
      guestEmail: input.guestEmail ?? null,
      summary: leadId ? 'Booking confirmed; sales cadence stopped' : 'Booking confirmed',
    },
  });
}

export function onBookingCancelled(input: {
  workspaceId: string;
  workerId: string;
  bookingId: string;
  leadId?: string | null;
  guestEmail?: string | null;
  policy?: BookingCancelPolicy;
}): SequenceEnrollment[] {
  const policy = input.policy ?? 'keep_stopped';
  const leadId = resolveOutreachLeadId(input);
  const resumed: SequenceEnrollment[] = [];

  if (leadId) {
    updateLead(input.workspaceId, leadId, { bookingState: 'none' });
    mutateOutreachStore((s) => {
      const idx = s.leads.findIndex((l) => l.id === leadId);
      if (idx >= 0) {
        s.leads[idx] = appendTimeline(s.leads[idx]!, {
          kind: 'system',
          message: `Booking cancelled (policy=${policy})`,
          meta: { bookingId: input.bookingId, policy },
        });
      }
    });

    if (policy === 'resume_booking_stops') {
      const stopped = listEnrollments(input.workspaceId, { leadId }).filter(
        (e) => e.status === 'stopped' && e.stopReason === 'booking',
      );
      for (const enrollment of stopped) {
        const next = resumeEnrollment(input.workspaceId, enrollment.id);
        if (next) resumed.push(next);
      }
    }
  }

  appendConciergeEvent({
    eventType: 'booking.cancelled',
    workspaceId: input.workspaceId,
    workerId: input.workerId,
    actorType: 'system',
    payload: {
      bookingId: input.bookingId,
      leadId,
      guestEmail: input.guestEmail ?? null,
      policy,
      resumedEnrollmentIds: resumed.map((e) => e.id),
      summary: `Booking cancelled; policy=${policy}`,
    },
  });

  return resumed;
}

export function onBookingOutcome(input: {
  workspaceId: string;
  workerId?: string | null;
  bookingId: string;
  outcome: 'attended' | 'no_show';
  leadId?: string | null;
  guestEmail?: string | null;
  recoverySequenceId?: string | null;
}): void {
  const leadId = resolveOutreachLeadId(input);
  if (leadId) {
    mutateOutreachStore((s) => {
      const idx = s.leads.findIndex((l) => l.id === leadId);
      if (idx >= 0) {
        const message =
          input.outcome === 'attended'
            ? 'Meeting attended; conversion funnel updated'
            : 'No-show recorded; recovery sequence eligible';
        const meta: Record<string, string> = {
          bookingId: input.bookingId,
          outcome: input.outcome,
        };
        if (input.recoverySequenceId) meta.recoverySequenceId = input.recoverySequenceId;
        s.leads[idx] = appendTimeline(s.leads[idx]!, {
          kind: input.outcome === 'attended' ? 'conversion' : 'system',
          message,
          meta,
        });
        if (input.outcome === 'attended') {
          s.leads[idx] = { ...s.leads[idx]!, status: 'won' };
        }
      }
    });
  }

  appendConciergeEvent({
    eventType: input.outcome === 'attended' ? 'conversation.closed' : 'booking.cancelled',
    workspaceId: input.workspaceId,
    workerId: input.workerId,
    actorType: 'operator',
    payload: {
      bookingId: input.bookingId,
      leadId,
      guestEmail: input.guestEmail ?? null,
      outcome: input.outcome,
      recoveryEligible: input.outcome === 'no_show',
      recoverySequenceId: input.recoverySequenceId ?? null,
      summary:
        input.outcome === 'attended'
          ? 'Attendance recorded'
          : 'No-show recorded; operator may start recovery sequence',
    },
  });
}

export function operatorResumeEnrollment(input: {
  workspaceId: string;
  workerId: string;
  enrollmentId: string;
  actorId?: string | null;
}): SequenceEnrollment | null {
  const before = loadOutreachStore().enrollments.find(
    (e) => e.workspaceId === input.workspaceId && e.id === input.enrollmentId,
  );
  const next = resumeEnrollment(input.workspaceId, input.enrollmentId);
  if (!next) return null;

  appendConciergeEvent({
    eventType: 'consent.changed',
    workspaceId: input.workspaceId,
    workerId: input.workerId,
    actorType: 'operator',
    actorId: input.actorId ?? null,
    payload: {
      enrollmentId: next.id,
      leadId: next.leadId,
      previousStatus: before?.status ?? null,
      previousStopReason: before?.stopReason ?? null,
      summary: 'Operator resumed outreach enrollment',
      sequenceName: getSequence(input.workspaceId, next.sequenceId)?.name ?? null,
    },
  });
  return next;
}
