import { mkdtemp, rm, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadHeartbeatState, saveHeartbeatState } from './heartbeat-state.js';

let tmpHome: string | undefined;

afterEach(async () => {
  if (tmpHome) await rm(tmpHome, { recursive: true, force: true });
  tmpHome = undefined;
});

describe('heartbeat-state', () => {
  it('persists check timestamps across cycles', async () => {
    tmpHome = await mkdtemp(path.join(os.tmpdir(), 'carina-hb-'));
    const initial = await loadHeartbeatState(tmpHome);
    expect(initial.lastChecks).toEqual({});

    await saveHeartbeatState({
      lastChecks: { email: '2026-06-16T10:00:00.000Z' },
      updatedAt: '2026-06-16T10:00:00.000Z',
    }, tmpHome);

    const loaded = await loadHeartbeatState(tmpHome);
    expect(loaded.lastChecks.email).toBe('2026-06-16T10:00:00.000Z');
  });
});
