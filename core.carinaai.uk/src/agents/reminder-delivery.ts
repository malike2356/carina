import { channelRegistry } from '../gateway/channels/channel-registry.js';
import type { ChannelName } from '../gateway/channels/channel-adapter.interface.js';
import { getSessionDelivery } from './cron-delivery-registry.js';
import {
  listDueReminders,
  markNoteDone,
  type CarinaNote,
} from '../gateway/notes-store.js';

const NON_DELIVERABLE = new Set<ChannelName>(['cli', 'web', 'api', 'webhooks']);

export interface ReminderInboxMessage {
  noteId: string;
  message: string;
  deliveredAt: string;
}

const webInbox: ReminderInboxMessage[] = [];

export type ReminderDeliverFn = (note: CarinaNote, message: string) => Promise<boolean>;

let deliverFn: ReminderDeliverFn | null = null;

export function setReminderDeliverFn(fn: ReminderDeliverFn): void {
  deliverFn = fn;
}

export function getWebReminderInbox(): ReminderInboxMessage[] {
  return [...webInbox];
}

export function acknowledgeWebReminder(noteId: string): void {
  const idx = webInbox.findIndex((entry) => entry.noteId === noteId);
  if (idx >= 0) webInbox.splice(idx, 1);
}

export function clearWebReminderInbox(): void {
  webInbox.length = 0;
}

export function formatReminderMessage(note: CarinaNote): string {
  const title = note.title.trim() || 'Reminder';
  const body = note.body.trim();
  return body ? `Reminder: ${title} - ${body}` : `Reminder: ${title}`;
}

async function defaultDeliver(note: CarinaNote, message: string): Promise<boolean> {
  if (note.deliverySessionId) {
    const delivery = getSessionDelivery(note.deliverySessionId);
    if (delivery && !NON_DELIVERABLE.has(delivery.channel)) {
      const adapter = channelRegistry.getByName(delivery.channel);
      if (adapter?.enabled && delivery.conversationId) {
        await adapter.sendMessage(delivery.conversationId, message, {
          threadId: delivery.threadId,
        });
        return true;
      }
    }
  }

  webInbox.push({
    noteId: note.id,
    message,
    deliveredAt: new Date().toISOString(),
  });
  return true;
}

export async function processDueReminders(now = new Date()): Promise<number> {
  const due = listDueReminders(now);
  let delivered = 0;

  for (const note of due) {
    const message = formatReminderMessage(note);
    const handler = deliverFn ?? defaultDeliver;
    const ok = await handler(note, message);
    if (ok) {
      markNoteDone(note.tenantId, note.id);
      delivered += 1;
    }
  }

  return delivered;
}

export function createReminderDeliveryTask(): {
  name: string;
  intervalMinutes: number;
  run: () => Promise<void>;
} {
  return {
    name: 'reminder-delivery',
    intervalMinutes: 1,
    run: async () => {
      const count = await processDueReminders();
      if (count > 0 && process.env.CARINA_REMINDER_VERBOSE === 'true') {
        console.log(`[reminders] delivered ${count} reminder(s)`);
      }
    },
  };
}
