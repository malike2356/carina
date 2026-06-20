import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearWebReminderInbox,
  formatReminderMessage,
  processDueReminders,
  setReminderDeliverFn,
} from './reminder-delivery.js';
import {
  configureNotesStore,
  createNote,
  getNote,
  resetNotesStore,
} from '../gateway/notes-store.js';

describe('reminder-delivery', () => {
  let homeDir: string;

  beforeEach(async () => {
    homeDir = path.join(os.tmpdir(), `carina-reminders-${randomUUID()}`);
    await fs.mkdir(homeDir, { recursive: true });
    resetNotesStore();
    configureNotesStore({ dbPath: path.join(homeDir, 'notes.db') });
    clearWebReminderInbox();
    setReminderDeliverFn(async () => true);
  });

  afterEach(async () => {
    resetNotesStore();
    clearWebReminderInbox();
    setReminderDeliverFn(async () => true);
    await fs.rm(homeDir, { recursive: true, force: true }).catch(() => {});
  });

  it('delivers the right message for overdue rows', async () => {
    const delivered: string[] = [];
    setReminderDeliverFn(async (note, message) => {
      delivered.push(message);
      expect(message).toBe(formatReminderMessage(note));
      return true;
    });

    const note = createNote('__operator__', {
      title: 'Call client',
      body: 'Follow up on proposal',
      format: 'reminder',
      remindAt: new Date(Date.now() - 60_000).toISOString(),
    });

    const count = await processDueReminders();
    expect(count).toBe(1);
    expect(delivered[0]).toContain('Call client');
    expect(delivered[0]).toContain('Follow up on proposal');
    expect(getNote('__operator__', note.id)?.done).toBe(true);
  });

  it('does not re-send already-done rows', async () => {
    let calls = 0;
    setReminderDeliverFn(async () => {
      calls += 1;
      return true;
    });

    const note = createNote('__operator__', {
      title: 'Done already',
      format: 'reminder',
      remindAt: new Date(Date.now() - 60_000).toISOString(),
      done: true,
    });

    const count = await processDueReminders();
    expect(count).toBe(0);
    expect(calls).toBe(0);
    expect(getNote('__operator__', note.id)?.done).toBe(true);
  });
});
