import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyOutreachStore, resetOutreachStoreCache, saveOutreachStore } from './store.js';
import { getOutreachControlState, isOutreachPaused, pauseOutreach, resumeOutreach } from './control.js';

describe('outreach control state', () => {
  let tmpHome = '';

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-outreach-control-'));
    vi.stubEnv('CARINA_HOME', tmpHome);
    resetOutreachStoreCache();
    saveOutreachStore(emptyOutreachStore());
  });

  afterEach(() => {
    resetOutreachStoreCache();
    vi.unstubAllEnvs();
  });

  it('pauses and resumes outreach per workspace', () => {
    expect(isOutreachPaused('ws-1')).toBe(false);
    const paused = pauseOutreach('ws-1', 'owner request', 'worker-1');
    expect(paused.paused).toBe(true);
    expect(getOutreachControlState('ws-1').reason).toBe('owner request');
    const resumed = resumeOutreach('ws-1', 'worker-1');
    expect(resumed.paused).toBe(false);
    expect(isOutreachPaused('ws-1')).toBe(false);
  });
});
