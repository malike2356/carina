import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getLocalMemories, insertLocalMemory, openLocalDb, type LocalDatabase } from './db.js';

let tmpDir = '';
let db: LocalDatabase | null = null;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'carina-db-'));
});

afterEach(async () => {
  db?.close();
  db = null;
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('local SQLite database', () => {
  it('creates schema and supports memory insert/select', () => {
    db = openLocalDb(path.join(tmpDir, 'carina.db'));

    const id = insertLocalMemory(db, {
      sessionId: 'session-1',
      role: 'user',
      content: 'Remember this',
    });
    const rows = getLocalMemories(db, 'session-1');

    expect(id).toHaveLength(36);
    expect(rows).toEqual([{ id, content: 'Remember this' }]);
  });
});
