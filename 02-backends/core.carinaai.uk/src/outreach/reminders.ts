import crypto from 'crypto';
import { getLead } from './leads.js';
import { appendTimeline } from './pipeline.js';
import { getBookingConfig } from './bookings.js';
import { loadOutreachStore, mutateOutreachStore } from './store.js';
import type { OutreachBooking, OutreachReminder, ReminderKind } from './types.js';

function nowIso(d = new Date()): string {
  return d.toISOString();
}

function reminderBody(booking: OutreachBooking, leadName: string): { subject: string; body: string } {
  const config = getBookingConfig(booking.workspaceId);
  const lines = [
    `Hi ${leadName || booking.attendeeName || 'there'},`,
    '',
    `Reminder: your discovery call is on ${new Date(booking.startsAt).toUTCString()}.`,
    booking.joinLink ? `Join link: ${booking.joinLink}` : '',
    config.prepVideoUrl ? `Prep video: ${config.prepVideoUrl}` : '',
    config.prepVideoTitle ? `Video title: ${config.prepVideoTitle}` : '',
    '',
    'If you need to reschedule, reply RESCHEDULE and we will move it.',
    '',
    'Best,',
  ].filter(Boolean);
  return {
    subject: 'Reminder: discovery call coming up',
    body: lines.join('\n'),
  };
}

export function listReminders(workspaceId: string, filter?: { bookingId?: string; status?: OutreachReminder['status'] }): OutreachReminder[] {
  return loadOutreachStore().reminders
    .filter((r) => r.workspaceId === workspaceId)
    .filter((r) => (!filter?.bookingId || r.bookingId === filter.bookingId))
    .filter((r) => (!filter?.status || r.status === filter.status))
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
}

export function scheduleBookingReminders(workspaceId: string, bookingId: string): OutreachReminder[] {
  const booking = loadOutreachStore().bookings.find((b) => b.workspaceId === workspaceId && b.id === bookingId);
  if (!booking) return [];
  const lead = getLead(workspaceId, booking.leadId);
  const leadName = lead?.name ?? booking.attendeeName ?? 'there';
  const starts = new Date(booking.startsAt).getTime();
  const config = getBookingConfig(workspaceId);
  const offsets = config.reminderOffsetsMinutes.length > 0 ? config.reminderOffsetsMinutes : [1440, 30];
  const plan: Array<{ kind: ReminderKind; dueAt: number; operatorAlert?: boolean }> = [
    { kind: '24h', dueAt: starts - (offsets[0] ?? 1440) * 60 * 1000 },
    { kind: '1h', dueAt: starts - (offsets[1] ?? 30) * 60 * 1000 },
    { kind: 'operator_alert', dueAt: starts - 30 * 60 * 1000, operatorAlert: true },
  ];

  const created: OutreachReminder[] = [];
  const stamp = nowIso();
  for (const item of plan) {
    if (item.dueAt <= Date.now()) continue;
    const reminder: OutreachReminder = {
      id: crypto.randomUUID(),
      workspaceId,
      bookingId: booking.id,
      leadId: booking.leadId,
      kind: item.kind,
      templateKey: booking.kind,
      dueAt: new Date(item.dueAt).toISOString(),
      status: 'scheduled',
      subject: reminderBody(booking, leadName).subject,
      body: reminderBody(booking, leadName).body,
      operatorAlert: item.operatorAlert,
      createdAt: stamp,
      updatedAt: stamp,
    };
    created.push(reminder);
  }

  mutateOutreachStore((store) => {
    store.reminders.push(...created);
    const leadIdx = store.leads.findIndex((l) => l.id === booking.leadId);
    if (leadIdx >= 0) {
      store.leads[leadIdx] = appendTimeline(store.leads[leadIdx]!, {
        kind: 'system',
        message: `Scheduled ${created.length} reminder(s) for booking`,
        meta: { bookingId },
      });
    }
  });
  return created;
}

export function cancelRemindersForBooking(workspaceId: string, bookingId: string, reason: string): number {
  let count = 0;
  mutateOutreachStore((store) => {
    for (let i = 0; i < store.reminders.length; i += 1) {
      const reminder = store.reminders[i]!;
      if (reminder.workspaceId !== workspaceId || reminder.bookingId !== bookingId) continue;
      if (reminder.status !== 'scheduled') continue;
      store.reminders[i] = {
        ...reminder,
        status: 'cancelled',
        skipReason: reason,
        updatedAt: nowIso(),
      };
      count += 1;
    }
    const booking = store.bookings.find((b) => b.id === bookingId);
    if (booking) {
      const leadIdx = store.leads.findIndex((l) => l.id === booking.leadId);
      if (leadIdx >= 0) {
        store.leads[leadIdx] = appendTimeline(store.leads[leadIdx]!, {
          kind: 'system',
          message: `Cancelled ${count} reminder(s) (${reason})`,
          meta: { bookingId, reason },
        });
      }
    }
  });
  return count;
}

export function processDueReminders(workspaceId: string, now: Date = new Date()): {
  sent: OutreachReminder[];
  skipped: OutreachReminder[];
  operatorAlerts: OutreachReminder[];
} {
  const due = listReminders(workspaceId, { status: 'scheduled' }).filter(
    (r) => new Date(r.dueAt).getTime() <= now.getTime(),
  );
  const sent: OutreachReminder[] = [];
  const skipped: OutreachReminder[] = [];
  const operatorAlerts: OutreachReminder[] = [];

  for (const reminder of due) {
    const booking = loadOutreachStore().bookings.find((b) => b.id === reminder.bookingId);
    if (!booking || booking.status === 'cancelled' || booking.status === 'rescheduled' || booking.status === 'no_show') {
      const next = {
        ...reminder,
        status: 'skipped' as const,
        skipReason: 'booking_inactive',
        updatedAt: nowIso(now),
      };
      mutateOutreachStore((store) => {
        const idx = store.reminders.findIndex((r) => r.id === reminder.id);
        if (idx >= 0) store.reminders[idx] = next;
      });
      skipped.push(next);
      continue;
    }

    // Soft Wall: mark sent as "queued"/logged; real Gmail send stays behind Approvals.
    const next = {
      ...reminder,
      status: 'sent' as const,
      updatedAt: nowIso(now),
    };
    mutateOutreachStore((store) => {
      const idx = store.reminders.findIndex((r) => r.id === reminder.id);
      if (idx >= 0) store.reminders[idx] = next;
      const leadIdx = store.leads.findIndex((l) => l.id === reminder.leadId);
      if (leadIdx >= 0) {
        store.leads[leadIdx] = appendTimeline(store.leads[leadIdx]!, {
          kind: 'delivery',
          message: reminder.operatorAlert
            ? `Operator alert: call in ~30 minutes (${booking.startsAt})`
            : `Reminder ${reminder.kind} queued for Soft Wall`,
          meta: { reminderId: reminder.id, bookingId: reminder.bookingId },
        });
      }
    });
    sent.push(next);
    if (reminder.operatorAlert) operatorAlerts.push(next);
  }

  return { sent, skipped, operatorAlerts };
}
