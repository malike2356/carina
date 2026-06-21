import { describe, expect, it, afterEach, beforeEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import {
  classifyTurnBucket,
  hashUserMessage,
  parseSinceArg,
  readTurnLogs,
  recordTurn,
  turnLogPath,
} from './turn-log.js';

let tmpHome: string;
const originalHome = process.env.CARINA_HOME;
const originalEnabled = process.env.CARINA_TURN_LOG;

beforeEach(async () => {
  tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), 'carina-turn-log-'));
  process.env.CARINA_HOME = tmpHome;
  process.env.CARINA_TURN_LOG = 'true';
});

afterEach(async () => {
  process.env.CARINA_HOME = originalHome;
  process.env.CARINA_TURN_LOG = originalEnabled;
  if (tmpHome) await fs.rm(tmpHome, { recursive: true, force: true });
});

describe('turn-log', () => {
  it('hashes user messages without storing raw text', () => {
    const hash = hashUserMessage('hello secret prompt');
    expect(hash).toHaveLength(16);
    expect(hash).not.toContain('secret');
  });

  it('writes and reads structured turn entries', async () => {
    await recordTurn({
      sessionId: 'tui:1',
      profile: 'work',
      platform: 'cli',
      provider: 'deepseek',
      model: 'deepseek-chat',
      latencyMs: 120,
      fastMode: true,
      complexity: 'simple',
      path: 'quick',
      toolsUsed: [],
      toolErrors: 0,
      userMessageHash: hashUserMessage('hi'),
      messageLength: 2,
      responseLength: 3,
    });

    const entries = await readTurnLogs({ limit: 10 });
    expect(entries).toHaveLength(1);
    expect(entries[0]!.sessionId).toBe('tui:1');
    expect(entries[0]!.bucket).toBe('ok');
    expect(turnLogPath()).toContain(tmpHome);
  });

  it('classifies slow and tool_error buckets', () => {
    expect(classifyTurnBucket({
      latencyMs: 9_000,
      toolErrors: 0,
      responseText: 'done',
      responseLength: 10,
    })).toBe('slow');

    expect(classifyTurnBucket({
      latencyMs: 50,
      toolErrors: 2,
      responseText: 'done',
      responseLength: 10,
    })).toBe('tool_error');
  });

  it('filters by bucket and since', async () => {
    await recordTurn({
      sessionId: 'a',
      profile: 'default',
      platform: 'cli',
      provider: 'deepseek',
      model: 'deepseek-chat',
      latencyMs: 9_000,
      fastMode: false,
      complexity: 'complex',
      path: 'single',
      toolsUsed: ['shell-exec'],
      toolErrors: 0,
      userMessageHash: 'abc',
      messageLength: 10,
      responseLength: 20,
      bucket: 'slow',
    });

    const slow = await readTurnLogs({ bucket: 'slow' });
    expect(slow).toHaveLength(1);

    const since = parseSinceArg('1h');
    const recent = await readTurnLogs({ since });
    expect(recent.length).toBeGreaterThan(0);
  });

  it('is a no-op when disabled', async () => {
    process.env.CARINA_TURN_LOG = 'false';
    await recordTurn({
      sessionId: 'x',
      profile: 'default',
      platform: 'cli',
      provider: 'deepseek',
      model: 'deepseek-chat',
      latencyMs: 1,
      fastMode: true,
      complexity: 'simple',
      path: 'quick',
      toolsUsed: [],
      toolErrors: 0,
      userMessageHash: 'x',
      messageLength: 1,
      responseLength: 1,
    });
    const entries = await readTurnLogs();
    expect(entries).toHaveLength(0);
  });
});
