/**
 * Scheduled maintenance windows with overlap detection and reminder ticks.
 */
import { randomUUID } from 'node:crypto';
import type { MaintenanceWindow } from './types.js';
import type { StatusStore } from './store.js';
import { sendMaintenanceReminder, type NotificationLog } from './notification-system.js';
import type { EmailSender } from './types.js';

const MIN_LEAD_MS = 48 * 60 * 60 * 1000;

export class MaintenanceConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MaintenanceConflictError';
  }
}

export class MaintenanceLeadTimeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MaintenanceLeadTimeError';
  }
}

function overlaps(a: MaintenanceWindow, b: { startsAt: string; endsAt: string }): boolean {
  const a0 = Date.parse(a.startsAt);
  const a1 = Date.parse(a.endsAt);
  const b0 = Date.parse(b.startsAt);
  const b1 = Date.parse(b.endsAt);
  return a0 < b1 && b0 < a1;
}

export function scheduleMaintenance(
  store: StatusStore,
  input: {
    title: string;
    description: string;
    affectedServices: string[];
    startsAt: string;
    endsAt: string;
    /** Skip 48h lead rule for emergency windows. */
    emergency?: boolean;
    now?: string;
  },
): MaintenanceWindow {
  const start = Date.parse(input.startsAt);
  const end = Date.parse(input.endsAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    throw new Error('Invalid maintenance window: endsAt must be after startsAt');
  }
  const now = Date.parse(input.now || new Date().toISOString());
  if (!input.emergency && start - now < MIN_LEAD_MS) {
    throw new MaintenanceLeadTimeError(
      'Non-emergency maintenance must be announced at least 48 hours in advance',
    );
  }
  for (const existing of store.listMaintenance()) {
    if (overlaps(existing, input)) {
      throw new MaintenanceConflictError(
        `Overlaps existing maintenance "${existing.title}" (${existing.startsAt} - ${existing.endsAt})`,
      );
    }
  }
  const window: MaintenanceWindow = {
    id: randomUUID(),
    title: input.title,
    description: input.description,
    affectedServices: [...input.affectedServices],
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    announcedAt: input.now || new Date().toISOString(),
    remindersSent: [],
  };
  store.addMaintenance(window);
  return window;
}

export function maintenanceCalendar(store: StatusStore, fromIso?: string): MaintenanceWindow[] {
  const from = Date.parse(fromIso || new Date().toISOString());
  return store
    .listMaintenance()
    .filter((m) => Date.parse(m.endsAt) >= from)
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
}

const REMINDER_OFFSETS: Array<{ key: '48h' | '24h' | '1h'; ms: number }> = [
  { key: '48h', ms: 48 * 60 * 60 * 1000 },
  { key: '24h', ms: 24 * 60 * 60 * 1000 },
  { key: '1h', ms: 60 * 60 * 1000 },
];

export async function autoNotifyBeforeMaintenance(
  store: StatusStore,
  recipients: string[],
  opts?: { now?: string; sender?: EmailSender; log?: NotificationLog; skewMs?: number },
): Promise<MaintenanceWindow[]> {
  const now = Date.parse(opts?.now || new Date().toISOString());
  const skew = opts?.skewMs ?? 5 * 60 * 1000;
  const touched: MaintenanceWindow[] = [];

  for (const window of store.listMaintenance()) {
    const start = Date.parse(window.startsAt);
    let changed = false;
    for (const rem of REMINDER_OFFSETS) {
      if (window.remindersSent.includes(rem.key)) continue;
      const dueAt = start - rem.ms;
      if (now >= dueAt && now <= dueAt + skew) {
        await sendMaintenanceReminder(window, rem.key, recipients, {
          sender: opts?.sender,
          log: opts?.log,
        });
        window.remindersSent.push(rem.key);
        changed = true;
      }
    }
    if (changed) {
      store.updateMaintenance(window);
      touched.push(window);
    }
  }
  return touched;
}
