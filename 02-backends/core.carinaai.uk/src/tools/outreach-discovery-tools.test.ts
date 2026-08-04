import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('outreach discovery tools', () => {
  let tmpHome: string;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-outreach-discovery-tools-'));
    vi.stubEnv('CARINA_HOME', tmpHome);
    vi.resetModules();
  });

  afterEach(() => {
    fs.rmSync(tmpHome, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  it('exposes plan and ingest tools for worker chat', async () => {
    const { createOutreachDiscoveryTools } = await import('./outreach-discovery-tools.js');
    const tools = createOutreachDiscoveryTools('session-1');
    expect(tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining([
        'outreach-discovery-plan',
        'outreach-discovery-sheet-schema',
        'outreach-discovery-normalize-leads',
        'outreach-discovery-ingest-leads',
      ]),
    );
  });
});
