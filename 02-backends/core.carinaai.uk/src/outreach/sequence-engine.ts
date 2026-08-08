import crypto from 'crypto';
import { countSentToday, isWithinBusinessHours } from './business-hours.js';
import { getCampaign, getLead, updateLead } from './leads.js';
import { appendTimeline, transitionLeadStatus } from './pipeline.js';
import { refreshFollowUpPlans } from './follow-ups.js';
import { syncLeadBoardState } from './kanban.js';
import { isOutreachPaused } from './control.js';
import { loadOutreachStore, mutateOutreachStore } from './store.js';
import type {
  DeliveryEvent,
  EnrollmentStopReason,
  OutreachSequence,
  SequenceEnrollment,
  SequenceStep,
} from './types.js';

function nowIso(d = new Date()): string {
  return d.toISOString();
}

function addHours(iso: string, hours: number): string {
  const d = new Date(iso);
  d.setTime(d.getTime() + hours * 60 * 60 * 1000);
  return d.toISOString();
}

export function listSequences(workspaceId: string): OutreachSequence[] {
  return loadOutreachStore().sequences.filter((s) => s.workspaceId === workspaceId);
}

export function getSequence(workspaceId: string, sequenceId: string): OutreachSequence | null {
  return listSequences(workspaceId).find((s) => s.id === sequenceId) ?? null;
}

export function createSequence(input: {
  workspaceId: string;
  name: string;
  description?: string;
  channelDefault?: OutreachSequence['channelDefault'];
  steps?: Array<Partial<SequenceStep> & { subject: string; body: string }>;
  stopOnReply?: boolean;
  stopOnBooking?: boolean;
  stopOnUnsubscribe?: boolean;
}): OutreachSequence {
  const stamp = nowIso();
  const steps: SequenceStep[] = (input.steps ?? defaultColdEmailSteps()).map((step, index) => ({
    id: step.id ?? crypto.randomUUID(),
    order: step.order ?? index,
    label: step.label ?? `Step ${index + 1}`,
    channel: step.channel ?? input.channelDefault ?? 'email',
    subject: step.subject,
    body: step.body,
    delayHours: step.delayHours ?? (index === 0 ? 0 : 48),
    cta: step.cta,
    link: step.link,
    attachmentNote: step.attachmentNote,
  }));

  const sequence: OutreachSequence = {
    id: crypto.randomUUID(),
    workspaceId: input.workspaceId,
    name: input.name.trim() || 'Untitled sequence',
    description: input.description,
    channelDefault: input.channelDefault ?? 'email',
    steps,
    stopOnReply: input.stopOnReply ?? true,
    stopOnBooking: input.stopOnBooking ?? true,
    stopOnUnsubscribe: input.stopOnUnsubscribe ?? true,
    createdAt: stamp,
    updatedAt: stamp,
  };
  mutateOutreachStore((s) => {
    s.sequences.push(sequence);
  });
  return sequence;
}

export function updateSequence(
  workspaceId: string,
  sequenceId: string,
  patch: Partial<{
    name: string;
    description: string | null;
    channelDefault: OutreachSequence['channelDefault'];
    steps: Array<Partial<SequenceStep> & { subject: string; body: string }>;
    stopOnReply: boolean;
    stopOnBooking: boolean;
    stopOnUnsubscribe: boolean;
  }>,
): OutreachSequence | null {
  const current = getSequence(workspaceId, sequenceId);
  if (!current) return null;
  const steps: SequenceStep[] = patch.steps
    ? patch.steps.map((step, index) => ({
        id: step.id ?? crypto.randomUUID(),
        order: step.order ?? index,
        label: step.label ?? `Step ${index + 1}`,
        channel: step.channel ?? patch.channelDefault ?? current.channelDefault ?? 'email',
        subject: step.subject,
        body: step.body,
        delayHours: step.delayHours ?? (index === 0 ? 0 : 48),
        cta: step.cta,
        link: step.link,
        attachmentNote: step.attachmentNote,
      }))
    : current.steps;

  const next: OutreachSequence = {
    ...current,
    name: patch.name !== undefined ? patch.name.trim() || current.name : current.name,
    description: patch.description !== undefined ? (patch.description?.trim() || undefined) : current.description,
    channelDefault: patch.channelDefault ?? current.channelDefault,
    steps,
    stopOnReply: patch.stopOnReply ?? current.stopOnReply,
    stopOnBooking: patch.stopOnBooking ?? current.stopOnBooking,
    stopOnUnsubscribe: patch.stopOnUnsubscribe ?? current.stopOnUnsubscribe,
    updatedAt: nowIso(),
  };
  mutateOutreachStore((s) => {
    const idx = s.sequences.findIndex((seq) => seq.id === sequenceId);
    if (idx >= 0) s.sequences[idx] = next;
  });
  return next;
}

export function defaultColdEmailSteps(): Array<Partial<SequenceStep> & { subject: string; body: string }> {
  return [
    {
      label: 'First touch',
      delayHours: 0,
      subject: 'Quick idea for {{company}}',
      body: 'Hi {{name}},\n\nI noticed {{company}} and thought this might help.\n\n{{cta}}\n\nBest',
      cta: 'Open to a 15-minute chat?',
    },
    {
      label: 'Follow-up 1',
      delayHours: 48,
      subject: 'Re: Quick idea for {{company}}',
      body: 'Hi {{name}},\n\nFollowing up in case this got buried.\n\n{{cta}}\n\nBest',
      cta: 'Happy to share a short example.',
    },
    {
      label: 'Follow-up 2',
      delayHours: 72,
      subject: 'Should I close the loop?',
      body: 'Hi {{name}},\n\nI will close the loop on my side unless a short call would still be useful.\n\n{{cta}}\n\nBest',
      cta: 'Reply yes and I will send times.',
    },
    {
      label: 'Follow-up 3',
      delayHours: 120,
      subject: 'Last note from me',
      body: 'Hi {{name}},\n\nLast note from me. If timing is wrong, reply stop and I will not follow up again.\n\nBest',
    },
  ];
}

function renderTemplate(
  template: string,
  lead: { name: string; company?: string; email?: string },
  cta?: string,
): string {
  return template
    .replaceAll('{{name}}', lead.name || 'there')
    .replaceAll('{{company}}', lead.company || 'your team')
    .replaceAll('{{email}}', lead.email || '')
    .replaceAll('{{cta}}', cta ?? '');
}

export function listEnrollments(workspaceId: string, filter?: {
  leadId?: string;
  campaignId?: string;
  status?: SequenceEnrollment['status'];
}): SequenceEnrollment[] {
  let rows = loadOutreachStore().enrollments.filter((e) => e.workspaceId === workspaceId);
  if (filter?.leadId) rows = rows.filter((e) => e.leadId === filter.leadId);
  if (filter?.campaignId) rows = rows.filter((e) => e.campaignId === filter.campaignId);
  if (filter?.status) rows = rows.filter((e) => e.status === filter.status);
  return rows;
}

export function enrollLead(input: {
  workspaceId: string;
  leadId: string;
  sequenceId: string;
  campaignId?: string;
  startAt?: Date;
}): SequenceEnrollment {
  const lead = getLead(input.workspaceId, input.leadId);
  if (!lead) throw new Error('Lead not found');
  const sequence = getSequence(input.workspaceId, input.sequenceId);
  if (!sequence || sequence.steps.length === 0) throw new Error('Sequence not found or empty');

  const existingActive = listEnrollments(input.workspaceId, { leadId: input.leadId, status: 'active' })
    .find((e) => e.sequenceId === input.sequenceId);
  if (existingActive) return existingActive;

  const stamp = input.startAt ? nowIso(input.startAt) : nowIso();
  const firstDelay = sequence.steps[0]?.delayHours ?? 0;
  const enrollment: SequenceEnrollment = {
    id: crypto.randomUUID(),
    workspaceId: input.workspaceId,
    leadId: input.leadId,
    sequenceId: input.sequenceId,
    campaignId: input.campaignId ?? lead.campaignId,
    status: 'active',
    currentStepIndex: 0,
    nextActionAt: addHours(stamp, firstDelay),
    enrolledAt: stamp,
    updatedAt: stamp,
  };

  mutateOutreachStore((s) => {
    s.enrollments.push(enrollment);
    const idx = s.leads.findIndex((l) => l.id === lead.id);
    if (idx >= 0) {
      let updated = appendTimeline(s.leads[idx]!, {
        kind: 'enrolled',
        message: `Enrolled in sequence ${sequence.name}`,
        meta: { sequenceId: sequence.id, enrollmentId: enrollment.id },
      });
      updated = { ...updated, nextActionAt: enrollment.nextActionAt, campaignId: enrollment.campaignId ?? updated.campaignId };
      s.leads[idx] = updated;
    }
  });
  return enrollment;
}

export function stopEnrollment(
  workspaceId: string,
  enrollmentId: string,
  reason: EnrollmentStopReason,
): SequenceEnrollment | null {
  const store = loadOutreachStore();
  const enrollment = store.enrollments.find((e) => e.workspaceId === workspaceId && e.id === enrollmentId);
  if (!enrollment) return null;
  if (enrollment.status !== 'active' && enrollment.status !== 'paused') return enrollment;

  const next: SequenceEnrollment = {
    ...enrollment,
    status: reason === 'manual_pause' ? 'paused' : 'stopped',
    stopReason: reason,
    nextActionAt: undefined,
    updatedAt: nowIso(),
  };
  mutateOutreachStore((s) => {
    const idx = s.enrollments.findIndex((e) => e.id === enrollmentId);
    if (idx >= 0) s.enrollments[idx] = next;
    const leadIdx = s.leads.findIndex((l) => l.id === enrollment.leadId);
    if (leadIdx >= 0) {
      s.leads[leadIdx] = appendTimeline(s.leads[leadIdx]!, {
        kind: 'stop',
        message: `Sequence ${reason === 'manual_pause' ? 'paused' : 'stopped'} (${reason})`,
        meta: { enrollmentId, reason },
      });
    }
  });
  return next;
}

export function recordLeadReply(workspaceId: string, leadId: string): void {
  const enrollments = listEnrollments(workspaceId, { leadId, status: 'active' });
  for (const enrollment of enrollments) {
    const sequence = getSequence(workspaceId, enrollment.sequenceId);
    if (sequence?.stopOnReply !== false) {
      stopEnrollment(workspaceId, enrollment.id, 'reply');
    }
  }
  updateLead(workspaceId, leadId, { status: 'replied', replyState: 'replied' });
  void refreshFollowUpPlans(workspaceId);
  void syncLeadBoardState(workspaceId, leadId, 'Inbound reply recorded').catch(() => undefined);
}

export function recordLeadBooking(workspaceId: string, leadId: string): void {
  const enrollments = listEnrollments(workspaceId, { leadId, status: 'active' });
  for (const enrollment of enrollments) {
    const sequence = getSequence(workspaceId, enrollment.sequenceId);
    if (sequence?.stopOnBooking !== false) {
      stopEnrollment(workspaceId, enrollment.id, 'booking');
    }
  }
  updateLead(workspaceId, leadId, { status: 'booked', bookingState: 'booked' });
  void refreshFollowUpPlans(workspaceId);
  void syncLeadBoardState(workspaceId, leadId, 'Booking recorded').catch(() => undefined);
}

export function recordLeadUnsubscribe(workspaceId: string, leadId: string): void {
  const enrollments = listEnrollments(workspaceId, { leadId, status: 'active' });
  for (const enrollment of enrollments) {
    const sequence = getSequence(workspaceId, enrollment.sequenceId);
    if (sequence?.stopOnUnsubscribe !== false) {
      stopEnrollment(workspaceId, enrollment.id, 'unsubscribe');
    }
  }
  updateLead(workspaceId, leadId, { replyState: 'unsubscribed' });
  void refreshFollowUpPlans(workspaceId);
  void syncLeadBoardState(workspaceId, leadId, 'Unsubscribed').catch(() => undefined);
}

export function listDeliveries(workspaceId: string, filter?: { leadId?: string; enrollmentId?: string }): DeliveryEvent[] {
  let rows = loadOutreachStore().deliveries.filter((d) => d.workspaceId === workspaceId);
  if (filter?.leadId) rows = rows.filter((d) => d.leadId === filter.leadId);
  if (filter?.enrollmentId) rows = rows.filter((d) => d.enrollmentId === filter.enrollmentId);
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export interface ProcessDueResult {
  processed: DeliveryEvent[];
  skipped: Array<{ enrollmentId: string; reason: string }>;
}

/**
 * Process due sequence steps. Soft Wall: creates `pending_approval` delivery events.
 * Does not call gmail-send. Mark sent after owner approval via markDeliveryStatus.
 */
export function processDueSends(workspaceId: string, now: Date = new Date()): ProcessDueResult {
  if (isOutreachPaused(workspaceId)) {
    const store = loadOutreachStore();
    const due = store.enrollments.filter(
      (e) =>
        e.workspaceId === workspaceId
        && e.status === 'active'
        && e.nextActionAt
        && new Date(e.nextActionAt).getTime() <= now.getTime(),
    );
    return {
      processed: [],
      skipped: due.map((enrollment) => ({ enrollmentId: enrollment.id, reason: 'paused' })),
    };
  }

  const store = loadOutreachStore();
  const due = store.enrollments.filter(
    (e) =>
      e.workspaceId === workspaceId
      && e.status === 'active'
      && e.nextActionAt
      && new Date(e.nextActionAt).getTime() <= now.getTime(),
  );

  const processed: DeliveryEvent[] = [];
  const skipped: Array<{ enrollmentId: string; reason: string }> = [];

  for (const enrollment of due) {
    const lead = getLead(workspaceId, enrollment.leadId);
    const sequence = getSequence(workspaceId, enrollment.sequenceId);
    if (!lead || !sequence) {
      skipped.push({ enrollmentId: enrollment.id, reason: 'missing_lead_or_sequence' });
      continue;
    }

    if (lead.replyState === 'unsubscribed') {
      stopEnrollment(workspaceId, enrollment.id, 'unsubscribe');
      skipped.push({ enrollmentId: enrollment.id, reason: 'unsubscribed' });
      continue;
    }
    if (lead.replyState === 'replied' && sequence.stopOnReply) {
      stopEnrollment(workspaceId, enrollment.id, 'reply');
      skipped.push({ enrollmentId: enrollment.id, reason: 'already_replied' });
      continue;
    }
    if ((lead.bookingState === 'booked' || lead.bookingState === 'attended') && sequence.stopOnBooking) {
      stopEnrollment(workspaceId, enrollment.id, 'booking');
      skipped.push({ enrollmentId: enrollment.id, reason: 'already_booked' });
      continue;
    }

    const campaign = enrollment.campaignId ? getCampaign(workspaceId, enrollment.campaignId) : null;
    const cadence = campaign?.cadence ?? {
      dailyCap: 10,
      timezone: lead.timezone ?? 'Europe/London',
      businessHoursStart: '09:00',
      businessHoursEnd: '17:00',
      businessDays: [1, 2, 3, 4, 5],
    };

    if (
      !isWithinBusinessHours({
        now,
        timezone: cadence.timezone,
        start: cadence.businessHoursStart,
        end: cadence.businessHoursEnd,
        businessDays: cadence.businessDays,
      })
    ) {
      skipped.push({ enrollmentId: enrollment.id, reason: 'outside_business_hours' });
      continue;
    }

    const campaignDeliveries = loadOutreachStore().deliveries.filter(
      (d) => d.workspaceId === workspaceId && (!enrollment.campaignId || getLead(workspaceId, d.leadId)?.campaignId === enrollment.campaignId),
    );
    const sentToday = countSentToday(campaignDeliveries, now, cadence.timezone);
    if (sentToday >= cadence.dailyCap) {
      skipped.push({ enrollmentId: enrollment.id, reason: 'daily_cap' });
      continue;
    }

    const step = sequence.steps[enrollment.currentStepIndex];
    if (!step) {
      mutateOutreachStore((s) => {
        const idx = s.enrollments.findIndex((e) => e.id === enrollment.id);
        if (idx >= 0) {
          s.enrollments[idx] = {
            ...s.enrollments[idx]!,
            status: 'completed',
            stopReason: 'completed',
            nextActionAt: undefined,
            updatedAt: nowIso(now),
          };
        }
      });
      skipped.push({ enrollmentId: enrollment.id, reason: 'completed' });
      continue;
    }

    if (!lead.email && step.channel === 'email') {
      skipped.push({ enrollmentId: enrollment.id, reason: 'missing_email' });
      continue;
    }

    const subject = renderTemplate(step.subject, lead, step.cta);
    const body = renderTemplate(step.body, lead, step.cta);
    const stamp = nowIso(now);
    const delivery: DeliveryEvent = {
      id: crypto.randomUUID(),
      workspaceId,
      enrollmentId: enrollment.id,
      leadId: lead.id,
      sequenceId: sequence.id,
      stepId: step.id,
      stepOrder: step.order,
      channel: step.channel,
      subject,
      body,
      status: 'pending_approval',
      scheduledFor: enrollment.nextActionAt ?? stamp,
      attempts: 1,
      createdAt: stamp,
      updatedAt: stamp,
    };

    const nextIndex = enrollment.currentStepIndex + 1;
    const nextStep = sequence.steps[nextIndex];
    const nextActionAt = nextStep ? addHours(stamp, nextStep.delayHours) : undefined;

    mutateOutreachStore((s) => {
      s.deliveries.push(delivery);
      const eIdx = s.enrollments.findIndex((e) => e.id === enrollment.id);
      if (eIdx >= 0) {
        s.enrollments[eIdx] = {
          ...s.enrollments[eIdx]!,
          currentStepIndex: nextIndex,
          nextActionAt,
          status: nextStep ? 'active' : 'completed',
          stopReason: nextStep ? undefined : 'completed',
          updatedAt: stamp,
        };
      }
      const lIdx = s.leads.findIndex((l) => l.id === lead.id);
      if (lIdx >= 0) {
        let updated = appendTimeline(s.leads[lIdx]!, {
          kind: 'delivery',
          message: `Queued ${step.label} for Soft Wall approval (${step.channel})`,
          meta: { deliveryId: delivery.id, stepId: step.id },
        });
        if (updated.status === 'new') {
          updated = transitionLeadStatus(updated, 'contacted', 'First sequence touch queued');
        }
        updated = {
          ...updated,
          lastContactedAt: stamp,
          nextActionAt,
          replyState: updated.replyState === 'none' ? 'awaiting' : updated.replyState,
        };
        s.leads[lIdx] = updated;
      }
    });
    void refreshFollowUpPlans(workspaceId);
    void syncLeadBoardState(workspaceId, lead.id, `Queued ${step.label}`).catch(() => undefined);

    processed.push(delivery);
  }

  return { processed, skipped };
}

export function markDeliveryStatus(
  workspaceId: string,
  deliveryId: string,
  status: DeliveryEvent['status'],
  extra?: { lastError?: string; approvalId?: string },
): DeliveryEvent | null {
  const delivery = loadOutreachStore().deliveries.find((d) => d.workspaceId === workspaceId && d.id === deliveryId);
  if (!delivery) return null;
  const next: DeliveryEvent = {
    ...delivery,
    status,
    lastError: extra?.lastError,
    approvalId: extra?.approvalId ?? delivery.approvalId,
    attempts: delivery.attempts + (status === 'failed' ? 1 : 0),
    updatedAt: nowIso(),
  };
  mutateOutreachStore((s) => {
    const idx = s.deliveries.findIndex((d) => d.id === deliveryId);
    if (idx >= 0) s.deliveries[idx] = next;
    const leadIdx = s.leads.findIndex((l) => l.id === delivery.leadId);
    if (leadIdx >= 0) {
      s.leads[leadIdx] = appendTimeline(s.leads[leadIdx]!, {
        kind: 'delivery',
        message: `Delivery ${status}`,
        meta: { deliveryId, status },
      });
    }
  });

  if (status === 'replied') recordLeadReply(workspaceId, delivery.leadId);
  if (status === 'unsubscribed') recordLeadUnsubscribe(workspaceId, delivery.leadId);
  return next;
}

export function retryFailedDelivery(workspaceId: string, deliveryId: string, now: Date = new Date()): DeliveryEvent | null {
  const delivery = loadOutreachStore().deliveries.find((d) => d.workspaceId === workspaceId && d.id === deliveryId);
  if (!delivery || delivery.status !== 'failed') return null;
  const next: DeliveryEvent = {
    ...delivery,
    status: 'pending_approval',
    attempts: delivery.attempts + 1,
    lastError: undefined,
    scheduledFor: nowIso(now),
    updatedAt: nowIso(now),
  };
  mutateOutreachStore((s) => {
    const idx = s.deliveries.findIndex((d) => d.id === deliveryId);
    if (idx >= 0) s.deliveries[idx] = next;
  });
  return next;
}
