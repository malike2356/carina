import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

vi.mock('../../workers/knowledge-base.js', () => ({
  OPS_KNOWLEDGE_WRITE: { enabled: false, countTowardLimit: false, maxChars: 200_000 },
  insertKnowledgeDocument: vi.fn(async (input: { title: string }) => ({
    id: 'kb-1',
    workerId: 'w1',
    workspaceId: 'ws1',
    type: 'document',
    title: input.title,
    content: 'x',
    charCount: 1,
    enabled: false,
    createdAt: new Date().toISOString(),
  })),
}));

vi.mock('../../utils/transcribe-audio.js', () => ({
  transcribeAudioFile: vi.fn(async () => ({ text: 'whisper transcript' })),
}));

import {
  googleRecorderPollCronExpression,
  isGoogleRecorderEnabledForWorkspace,
  isGoogleRecorderIngestionEnabled,
} from './recorder-config.js';
import { ingestRecorderItem } from './recorder-ingest.js';
import { fetchRecorderListings } from './recorder-browser.js';
import { insertKnowledgeDocument } from '../../workers/knowledge-base.js';

describe('google recorder config', () => {
  const prev = { ...process.env };

  afterEach(() => {
    process.env = { ...prev };
  });

  it('defaults poll cron to every 15 minutes', () => {
    delete process.env.AIVA_GOOGLE_RECORDER_POLL_CRON;
    expect(googleRecorderPollCronExpression()).toBe('*/15 * * * *');
  });

  it('respects global enable and pilot workspaces', () => {
    process.env.AIVA_GOOGLE_RECORDER_ENABLED = 'false';
    process.env.AIVA_GOOGLE_RECORDER_PILOT_WORKSPACE_IDS = 'Aa, Bb';
    expect(isGoogleRecorderIngestionEnabled()).toBe(false);
    expect(isGoogleRecorderEnabledForWorkspace('aa')).toBe(true);
    expect(isGoogleRecorderEnabledForWorkspace('zz')).toBe(false);
  });
});

describe('google recorder ingest', () => {
  it('stores Google transcript without Whisper when present', async () => {
    const result = await ingestRecorderItem({
      workerId: '11111111-1111-4111-8111-111111111111',
      workspaceId: '22222222-2222-4222-8222-222222222222',
      item: {
        id: 'rec-1',
        title: 'Standup notes',
        transcript: 'We shipped Path A today.',
      },
    });
    expect(result.source).toBe('google-transcript');
    expect(result.knowledgeEntryId).toBe('kb-1');
    expect(insertKnowledgeDocument).toHaveBeenCalled();
  });

  it('falls back to Whisper when only audio is present', async () => {
    const tmp = path.join(os.tmpdir(), `rec-${Date.now()}.m4a`);
    await fs.writeFile(tmp, Buffer.from('fake'));
    const result = await ingestRecorderItem({
      workerId: '11111111-1111-4111-8111-111111111111',
      workspaceId: '22222222-2222-4222-8222-222222222222',
      item: {
        id: 'rec-2',
        title: 'Voice memo',
        audioPath: tmp,
      },
    });
    expect(result.source).toBe('whisper');
  });
});

describe('google recorder fixture fetch', () => {
  let fixtureDir = '';

  beforeEach(async () => {
    fixtureDir = await fs.mkdtemp(path.join(os.tmpdir(), 'recorder-fix-'));
    process.env.AIVA_GOOGLE_RECORDER_FIXTURE_DIR = fixtureDir;
    await fs.writeFile(
      path.join(fixtureDir, 'listings.json'),
      JSON.stringify({
        items: [
          { id: 'a', title: 'One', transcript: 'alpha' },
          { id: 'b', title: 'Two', transcript: 'beta' },
        ],
      }),
    );
  });

  afterEach(async () => {
    delete process.env.AIVA_GOOGLE_RECORDER_FIXTURE_DIR;
    await fs.rm(fixtureDir, { recursive: true, force: true });
  });

  it('filters known ids from fixture listings', async () => {
    const result = await fetchRecorderListings({
      storageState: {},
      knownIds: new Set(['a']),
    });
    expect(result.sessionValid).toBe(true);
    expect(result.items.map((i) => i.id)).toEqual(['b']);
  });
});
