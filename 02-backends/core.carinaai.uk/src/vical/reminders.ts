/**
 * viCal booking reminders (file-backed schedule rows; process-due worker).
 */
import crypto from 'crypto';
import type { VcalBooking, VcalReminder, VcalReminderKind } from './types.js';
import { getBooking } from './bookings.js';
import { loadVicalStore, mutateVicalStore } from './store.js';

function nowIso(d = new Date()): string {
  return d.toISOString();
}

function reminderCopy(booking: VcalBooking, kind: VcalReminderKind): { subject: string; body: string } {
  const manageHint = booking.guestToken
    ? `Manage link token: ${booking.guestToken}`
    : 'Reply to reschedule or cancel.';
  const lines = [
    `Hi ${booking.guestName || 'there'},`,
    '',
    kind === 'operator_alert'
      ? `Host alert: upcoming booking with ${booking.guestName} at ${new Date(booking.startsAt).toUTCString()}.`
      : `Reminder: your meeting is on ${new Date(booking.startsAt).toUTCString()} (${booking.timezone}).`,
    booking.meetingUrl ? `Join link: ${booking.meetingUrl}` : '',
    manageHint,
    '',
    'Best,',
  ].filter(Boolean);
  return {
    subject: kind === 'operator_alert' ? 'Host alert: upcoming booking' : 'Reminder: upcoming meeting',
    body: lines.join('\n'),
  };
}

export function listVicalReminders(
  workspaceId: string,
  filter?: { bookingId?: string; status?: VcalReminder['status'] },
): VcalReminder[] {
  return loadVicalStore()
    .reminders.filter((r) => r.workspaceId === workspaceId)
    .filter((r) => (!filter?.bookingId || r.bookingId === filter.bookingId))
    .filter((r) => (!filter?.status || r.status === filter.status))
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
}

export function cancelVicalRemindersForBooking(
  workspaceId: string,
  bookingId: string,
  reason: string,
): number {
  let count = 0;
  mutateVicalStore((store) => {
    for (let i = 0; i < store.reminders.length; i += 1) {
      const row = store.reminders[i]!;
      if (row.workspaceId !== workspaceId || row.bookingId !== bookingId) continue;
      if (row.status !== 'scheduled') continue;
      store.reminders[i] = {
        ...row,
        status: 'cancelled',
        skipReason: reason,
        updatedAt: nowIso(),
      };
      count += 1;
    }
  });
  return count;
}

export function scheduleVicalReminders(input: {
  workspaceId: string;
  bookingId: string;
  offsetsMinutes?: number[];
}): VcalReminder[] {
  const booking = getBooking(input.workspaceId, input.bookingId);
  if (!booking || booking.status !== 'confirmed') return [];
  cancelVicalRemindersForBooking(input.workspaceId, input.bookingId, 'reschedule_or_replan');

  const offsets = (input.offsetsMinutes?.length ? input.offsetsMinutes : [1440, 30]).map((n) =>
    Math.max(1, Math.min(10080, Number(n))),
  );
  const starts = new Date(booking.startsAt).getTime();
  const stamp = nowIso();
  const created: VcalReminder[] = [];

  const plan: Array<{ kind: VcalReminderKind; offset: number }> = [
    { kind: '24h', offset: offsets[0]! },
    { kind: '1h', offset: offsets[1] ?? offsets[0]! },
    { kind: 'operator_alert', offset: 30 },
  ];

  for (const item of plan) {
    const dueAt = starts - item.offset * 60 * 1000;
    if (dueAt <= Date.now()) continue;
    const copy = reminderCopy(booking, item.kind);
    created.push({
      id: crypto.randomUUID(),
      workspaceId: input.workspaceId,
      bookingId: booking.id,
      kind: item.kind,
      offsetMinutes: item.offset,
      dueAt: new Date(dueAt).toISOString(),
      status: 'scheduled',
      subject: copy.subject,
      body: copy.body,
      createdAt: stamp,
      updatedAt: stamp,
    });
  }

  mutateVicalStore((store) => {
    store.reminders.push(...created);
  });
  return created;
}

export function processDueVicalReminders(
  workspaceId: string,
  now = new Date(),
): { sent: number; reminders: VcalReminder[] } {
  const due = listVicalReminders(workspaceId, { status: 'scheduled' }).filter(
    (r) => new Date(r.dueAt).getTime() <= now.getTime(),
  );
  const stamped = nowIso(now);
  const sentRows: VcalReminder[] = [];
  mutateVicalStore((store) => {
    for (const dueRow of due) {
      const idx = store.reminders.findIndex((r) => r.id === dueRow.id);
      if (idx < 0) continue;
      const next: VcalReminder = {
        ...store.reminders[idx]!,
        status: 'sent',
        sentAt: stamped,
        updatedAt: stamped,
      };
      store.reminders[idx] = next;
      sentRows.push(next);
    }
  });
  return { sent: sentRows.length, reminders: sentRows };
}
