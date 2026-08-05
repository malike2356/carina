import crypto from 'crypto';
import { appendTimeline } from './pipeline.js';
import { getLead, updateLead } from './leads.js';
import { listBookings } from './bookings.js';
import { getOutreachAlertTarget, sendOutreachTelegramAlert } from './alerts.js';
import { loadOutreachStore, mutateOutreachStore } from './store.js';
import { syncLeadBoardState } from './kanban.js';
import type { FollowUpTask, OutreachBooking, OutreachLead, PostCallOutcome } from './types.js';

function nowIso(d = new Date()): string {
  return d.toISOString();
}

function dueAt(baseIso: string, days: number): string {
  return new Date(new Date(baseIso).getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

function keyFor(task: Pick<FollowUpTask, 'workspaceId' | 'leadId' | 'kind' | 'bookingId'>): string {
  return [task.workspaceId, task.leadId, task.kind, task.bookingId ?? ''].join(':');
}

function taskExists(task: Pick<FollowUpTask, 'workspaceId' | 'leadId' | 'kind' | 'bookingId'>): FollowUpTask | null {
  const key = keyFor(task);
  return loadOutreachStore().followUpTasks.find((row) => keyFor(row) === key) ?? null;
}

function upsertTask(task: FollowUpTask): FollowUpTask {
  mutateOutreachStore((store) => {
    const idx = store.followUpTasks.findIndex((row) => row.id === task.id);
    if (idx >= 0) store.followUpTasks[idx] = task;
    else store.followUpTasks.push(task);
  });
  return task;
}

function createTask(input: Omit<FollowUpTask, 'id' | 'createdAt' | 'updatedAt' | 'status'> & { status?: FollowUpTask['status'] }): FollowUpTask {
  const stamp = nowIso();
  return upsertTask({
    id: crypto.randomUUID(),
    status: input.status ?? 'scheduled',
    createdAt: stamp,
    updatedAt: stamp,
    ...input,
  });
}

function buildTaskCopy(lead: OutreachLead, kind: FollowUpTask['kind'], booking?: OutreachBooking): { subject: string; body: string; actionLabel: string; channel: FollowUpTask['channel'] } {
  const name = lead.name || 'there';
  switch (kind) {
    case 'cold_no_reply_day_3':
      return {
        subject: `Follow up with ${name}`,
        body: `No reply after the first touch. Send a short follow up and ask if timing is off.`,
        actionLabel: 'Follow up day 3',
        channel: 'telegram',
      };
    case 'cold_no_reply_day_7':
      return {
        subject: `Close the loop with ${name}`,
        body: `No reply after the second touch. Close the loop politely and stop if they are not interested.`,
        actionLabel: 'Follow up day 7',
        channel: 'telegram',
      };
    case 'interested_day_1':
      return {
        subject: `Send times to ${name}`,
        body: `They are interested but not booked. Send the booking link or a couple of times today.`,
        actionLabel: 'Booking nudge day 1',
        channel: 'telegram',
      };
    case 'interested_day_3':
      return {
        subject: `Second booking nudge for ${name}`,
        body: `Still not booked. Send one more booking nudge and ask for a preferred time.`,
        actionLabel: 'Booking nudge day 3',
        channel: 'telegram',
      };
    case 'no_show_day_0_evening':
      return {
        subject: `No-show follow up for ${name}`,
        body: `They missed the call today. Send a calm reschedule note this evening.`,
        actionLabel: 'No-show evening follow up',
        channel: 'telegram',
      };
    case 'no_show_day_2':
      return {
        subject: `Second no-show follow up for ${name}`,
        body: `They still have not rebooked. Send a second reschedule note after two days.`,
        actionLabel: 'No-show day 2 follow up',
        channel: 'telegram',
      };
    case 'owner_day_2_outcome':
      return {
        subject: `Log the outcome for ${name}`,
        body: `The call has ended. Ask the owner to log Won, Proposal sent, Follow-up date, Dead, or No-show.`,
        actionLabel: 'Owner outcome prompt',
        channel: 'telegram',
      };
    case 'post_call_qualified_next_step':
      return {
        subject: `Create the next step for ${name}`,
        body: `The call qualified. Create the next action and keep the deal moving.`,
        actionLabel: 'Qualified next step',
        channel: 'telegram',
      };
    case 'post_call_proposal_draft':
      return {
        subject: `Draft proposal work for ${name}`,
        body: `The call needs a proposal. Create the draft, capture scope, and prepare the follow-up.`,
        actionLabel: 'Proposal draft task',
        channel: 'telegram',
      };
    case 'post_call_follow_up':
      return {
        subject: `Follow up with ${name}`,
        body: `The call needs another touch. Schedule the follow-up and keep the notes visible.`,
        actionLabel: 'Post-call follow-up',
        channel: 'telegram',
      };
    case 'post_call_not_a_fit_close':
      return {
        subject: `Close out ${name}`,
        body: `The call was not a fit. Close the lead cleanly and preserve the history.`,
        actionLabel: 'Close out lead',
        channel: 'telegram',
      };
    case 'post_call_won_onboarding':
      return {
        subject: `Start onboarding for ${name}`,
        body: `The deal is won. Create onboarding and fulfillment handoff items now.`,
        actionLabel: 'Won onboarding task',
        channel: 'telegram',
      };
    case 'post_call_lost_closeout':
      return {
        subject: `Archive ${name}`,
        body: `The deal is lost. Close the record and keep the notes for future reference.`,
        actionLabel: 'Lost closeout task',
        channel: 'telegram',
      };
  }
}

function scheduleSingleTask(
  workspaceId: string,
  lead: OutreachLead,
  kind: FollowUpTask['kind'],
  dueAt: string,
  bookingId?: string,
): FollowUpTask | null {
  const exists = taskExists({ workspaceId, leadId: lead.id, kind, bookingId });
  if (exists) return exists;
  const copy = buildTaskCopy(lead, kind);
  return createTask({
    workspaceId,
    leadId: lead.id,
    bookingId,
    kind,
    dueAt,
    subject: copy.subject,
    body: copy.body,
    channel: copy.channel,
    actionLabel: copy.actionLabel,
  });
}

function scheduleColdFollowUps(workspaceId: string, lead: OutreachLead): void {
  if (lead.replyState === 'unsubscribed' || lead.status === 'lost' || lead.status === 'won') return;
  if (!lead.lastContactedAt) return;
  const day3 = dueAt(lead.lastContactedAt, 3);
  const day7 = dueAt(lead.lastContactedAt, 7);
  for (const [kind, due] of [['cold_no_reply_day_3', day3], ['cold_no_reply_day_7', day7]] as const) {
    const exists = taskExists({ workspaceId, leadId: lead.id, kind, bookingId: undefined });
    if (exists) continue;
    const copy = buildTaskCopy(lead, kind);
    createTask({
      workspaceId,
      leadId: lead.id,
      kind,
      dueAt: due,
      subject: copy.subject,
      body: copy.body,
      channel: copy.channel,
      actionLabel: copy.actionLabel,
    });
  }
}

function scheduleInterestFollowUps(workspaceId: string, lead: OutreachLead): void {
  if (lead.replyState !== 'replied' || lead.bookingState !== 'offered') return;
  const anchor = lead.updatedAt;
  for (const [kind, offset] of [['interested_day_1', 1], ['interested_day_3', 3]] as const) {
    const exists = taskExists({ workspaceId, leadId: lead.id, kind, bookingId: undefined });
    if (exists) continue;
    const copy = buildTaskCopy(lead, kind);
    createTask({
      workspaceId,
      leadId: lead.id,
      kind,
      dueAt: dueAt(anchor, offset),
      subject: copy.subject,
      body: copy.body,
      channel: copy.channel,
      actionLabel: copy.actionLabel,
    });
  }
}

function scheduleNoShowFollowUps(workspaceId: string, lead: OutreachLead, booking: OutreachBooking): void {
  if (booking.status !== 'no_show') return;
  const evening = new Date(booking.startsAt);
  evening.setUTCHours(18, 0, 0, 0);
  const sameDayDue = evening.toISOString();
  const laterDue = dueAt(booking.startsAt, 2);
  for (const [kind, due] of [['no_show_day_0_evening', sameDayDue], ['no_show_day_2', laterDue]] as const) {
    const exists = taskExists({ workspaceId, leadId: lead.id, kind, bookingId: booking.id });
    if (exists) continue;
    const copy = buildTaskCopy(lead, kind, booking);
    createTask({
      workspaceId,
      leadId: lead.id,
      bookingId: booking.id,
      kind,
      dueAt: due,
      subject: copy.subject,
      body: copy.body,
      channel: copy.channel,
      actionLabel: copy.actionLabel,
    });
  }
}

function scheduleOutcomePrompt(workspaceId: string, lead: OutreachLead, booking: OutreachBooking): void {
  if (booking.postCallOutcome) return;
  if (booking.status !== 'confirmed' && booking.status !== 'attended') return;
  if (new Date(booking.endsAt).getTime() > Date.now()) return;
  const exists = taskExists({ workspaceId, leadId: lead.id, kind: 'owner_day_2_outcome', bookingId: booking.id });
  if (exists) return;
  createTask({
    workspaceId,
    leadId: lead.id,
    bookingId: booking.id,
    kind: 'owner_day_2_outcome',
    dueAt: dueAt(booking.endsAt, 2),
    subject: `Log meeting outcome for ${lead.name}`,
    body: 'Ask the owner to log Won, Proposal sent, Follow-up date, Dead, or No-show.',
    channel: 'telegram',
    actionLabel: 'Owner outcome prompt',
  });
}

export function schedulePostCallOutcomeTask(
  workspaceId: string,
  lead: OutreachLead,
  booking: OutreachBooking,
  outcome: PostCallOutcome,
): FollowUpTask | null {
  const dueAtIso =
    outcome === 'qualified'
      ? dueAt(booking.endsAt, 1)
      : outcome === 'proposal_needed'
        ? dueAt(booking.endsAt, 0)
        : outcome === 'needs_follow_up'
          ? dueAt(booking.endsAt, 2)
          : outcome === 'not_a_fit'
            ? dueAt(booking.endsAt, 0)
            : outcome === 'won'
              ? dueAt(booking.endsAt, 0)
              : dueAt(booking.endsAt, 0);
  const kind =
    outcome === 'qualified'
      ? 'post_call_qualified_next_step'
      : outcome === 'proposal_needed'
        ? 'post_call_proposal_draft'
        : outcome === 'needs_follow_up'
          ? 'post_call_follow_up'
          : outcome === 'not_a_fit'
            ? 'post_call_not_a_fit_close'
            : outcome === 'won'
              ? 'post_call_won_onboarding'
              : 'post_call_lost_closeout';
  const task = scheduleSingleTask(workspaceId, lead, kind, dueAtIso, booking.id);
  if (!task) return null;
  if (outcome === 'qualified' || outcome === 'proposal_needed' || outcome === 'needs_follow_up') {
    mutateOutreachStore((store) => {
      const idx = store.leads.findIndex((row) => row.id === lead.id);
      if (idx >= 0) {
        store.leads[idx] = { ...store.leads[idx]!, nextActionAt: task.dueAt, updatedAt: nowIso() };
      }
    });
  }
  return task;
}

export function refreshFollowUpPlans(workspaceId: string): { created: number } {
  const leads = loadOutreachStore().leads.filter((lead) => lead.workspaceId === workspaceId);
  let created = 0;
  for (const lead of leads) {
    const before = loadOutreachStore().followUpTasks.length;
    scheduleColdFollowUps(workspaceId, lead);
    scheduleInterestFollowUps(workspaceId, lead);
    for (const booking of listBookings(workspaceId, { leadId: lead.id })) {
      scheduleNoShowFollowUps(workspaceId, lead, booking);
      scheduleOutcomePrompt(workspaceId, lead, booking);
    }
    created += Math.max(0, loadOutreachStore().followUpTasks.length - before);
  }
  return { created };
}

export function listFollowUpTasks(workspaceId: string, status?: FollowUpTask['status']): FollowUpTask[] {
  return loadOutreachStore().followUpTasks
    .filter((task) => task.workspaceId === workspaceId && (!status || task.status === status))
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
}

export function buildWeeklyOwnerDigest(workspaceId: string, now = new Date()): {
  generatedAt: string;
  counts: Record<string, number>;
  staleLeads: Array<{ leadId: string; name: string; lastTouchAt: string | null; daysStale: number }>;
  followUpsDue: number;
} {
  const leads = loadOutreachStore().leads.filter((lead) => lead.workspaceId === workspaceId);
  const counts = leads.reduce((acc, lead) => {
    acc[lead.status] = (acc[lead.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const staleLeads = leads
    .map((lead) => {
      const lastTouch = lead.lastContactedAt ?? lead.updatedAt;
      const daysStale = Math.floor((now.getTime() - new Date(lastTouch).getTime()) / (24 * 60 * 60 * 1000));
      return { leadId: lead.id, name: lead.name, lastTouchAt: lead.lastContactedAt ?? null, daysStale };
    })
    .filter((row) => row.daysStale >= 7)
    .sort((a, b) => b.daysStale - a.daysStale);
  return {
    generatedAt: now.toISOString(),
    counts,
    staleLeads,
    followUpsDue: listFollowUpTasks(workspaceId, 'scheduled').filter((task) => new Date(task.dueAt).getTime() <= now.getTime()).length,
  };
}

export async function processDueFollowUps(workspaceId: string, now = new Date()): Promise<{
  sent: FollowUpTask[];
  skipped: FollowUpTask[];
}> {
  refreshFollowUpPlans(workspaceId);
  const due = listFollowUpTasks(workspaceId, 'scheduled').filter((task) => new Date(task.dueAt).getTime() <= now.getTime());
  const sent: FollowUpTask[] = [];
  const skipped: FollowUpTask[] = [];
  const alertTarget = getOutreachAlertTarget(workspaceId);

  for (const task of due) {
    const lead = getLead(workspaceId, task.leadId);
    if (!lead) {
      const next = { ...task, status: 'skipped' as const, skipReason: 'lead_missing', updatedAt: nowIso(now) };
      upsertTask(next);
      skipped.push(next);
      continue;
    }
    if (lead.replyState === 'unsubscribed' || lead.status === 'lost') {
      const next = { ...task, status: 'skipped' as const, skipReason: 'inactive_lead', updatedAt: nowIso(now) };
      upsertTask(next);
      skipped.push(next);
      continue;
    }

    const next = { ...task, status: 'sent' as const, updatedAt: nowIso(now) };
    upsertTask(next);
    sent.push(next);

    const touched = updateLead(workspaceId, lead.id, {
      nextActionAt: null,
    });
    if (touched) {
      const timelineLead = appendTimeline(touched, {
        kind: 'system',
        message: task.subject,
        meta: { followUpTaskId: task.id, followUpKind: task.kind },
      });
      mutateOutreachStore((store) => {
        const idx = store.leads.findIndex((row) => row.id === lead.id);
        if (idx >= 0) store.leads[idx] = timelineLead;
      });
      await syncLeadBoardState(workspaceId, lead.id, task.subject).catch(() => undefined);
    }

    if (alertTarget.enabled) {
      await sendOutreachTelegramAlert({
        workspaceId,
        title: task.actionLabel,
        message: `${lead.name}: ${task.body}`,
        workerId: alertTarget.workerId,
      }).catch(() => undefined);
    }
  }

  return { sent, skipped };
}

export function markLeadOutcomePrompted(workspaceId: string, leadId: string, bookingId?: string): void {
  mutateOutreachStore((store) => {
    store.followUpTasks = store.followUpTasks.map((task) => {
      if (task.workspaceId !== workspaceId || task.leadId !== leadId) return task;
      if (bookingId && task.bookingId !== bookingId) return task;
      if (task.kind !== 'owner_day_2_outcome') return task;
      return { ...task, status: 'sent', updatedAt: nowIso() };
    });
  });
}
