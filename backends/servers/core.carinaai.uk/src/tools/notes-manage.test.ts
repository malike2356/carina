import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { notesManageTool } from './notes-manage.js';
import {
  configureNotesStore,
  resetNotesStore,
} from '../gateway/notes-store.js';

describe('notes-manage', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-notes-tool-'));
    configureNotesStore({ dbPath: path.join(tmpDir, 'notes.db') });
  });

  afterEach(() => {
    resetNotesStore();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates and lists notes', async () => {
    const created = await notesManageTool.execute({
      action: 'create',
      title: 'Plan',
      body: 'Ship inventory',
      format: 'note',
    }) as { note: { id: string; title: string } };
    expect(created.note.title).toBe('Plan');

    const listed = await notesManageTool.execute({ action: 'list' }) as {
      count: number;
      notes: Array<{ id: string }>;
    };
    expect(listed.count).toBe(1);
    expect(listed.notes[0]?.id).toBe(created.note.id);
  });

  it('updates and deletes a note', async () => {
    const created = await notesManageTool.execute({
      action: 'create',
      title: 'Task',
      format: 'task',
    }) as { note: { id: string } };

    const updated = await notesManageTool.execute({
      action: 'update',
      id: created.note.id,
      done: true,
    }) as { note: { done: boolean } };
    expect(updated.note.done).toBe(true);

    const deleted = await notesManageTool.execute({
      action: 'delete',
      id: created.note.id,
    }) as { status: string };
    expect(deleted.status).toBe('deleted');
  });

  it('returns error when get misses', async () => {
    const result = await notesManageTool.execute({
      action: 'get',
      id: 'missing-id',
    }) as { error?: string };
    expect(result.error).toContain('not found');
  });
});
