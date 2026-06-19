import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { summarizeSessionTelemetry } from './session-telemetry.js';

describe('session-telemetry', () => {
  let tmpHome: string;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-session-tel-'));
    process.env.CARINA_HOME = tmpHome;
  });

  afterEach(() => {
    delete process.env.CARINA_HOME;
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  it('returns zeroed summary when no turn logs exist', async () => {
    const summary = await summarizeSessionTelemetry(24);
    expect(summary.uniqueSessions).toBe(0);
    expect(summary.turns).toBe(0);
    expect(summary.avgLatencyMs).toBe(0);
    expect(summary.buckets.ok).toBe(0);
  });
});
