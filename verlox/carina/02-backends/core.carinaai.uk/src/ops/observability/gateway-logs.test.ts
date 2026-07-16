import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { collectGatewayLogs, appendGatewayLog } from './gateway-logs.js';

describe('gateway-logs', () => {
  let tmpHome: string;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-logs-'));
    process.env.CARINA_HOME = tmpHome;
  });

  afterEach(() => {
    delete process.env.CARINA_HOME;
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  it('collects gateway log lines from appendGatewayLog', async () => {
    appendGatewayLog({ level: 'info', message: 'test event' });
    const logs = await collectGatewayLogs({ limit: 10 });
    expect(logs.some((l) => l.message === 'test event')).toBe(true);
  });
});
