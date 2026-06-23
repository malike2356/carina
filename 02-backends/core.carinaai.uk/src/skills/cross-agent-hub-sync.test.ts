import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { exportSharedSkillsBundle, mergeSharedSkillsBundle } from './cross-agent-hub-sync.js';
import type { SharedSkillRecord } from './cross-agent-learning.js';

describe('cross-agent-hub-sync', () => {
  let tmpHome: string;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-share-'));
    process.env.CARINA_HOME = tmpHome;
  });

  afterEach(() => {
    delete process.env.CARINA_HOME;
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  it('exports and merges shared skill bundles', async () => {
    const skills: SharedSkillRecord[] = [{
      skillName: 'negotiate-lease',
      skillId: 'sk-1',
      sourceAgentId: 'propreneur',
      targetAgentIds: ['fleet'],
      propagatedAt: new Date().toISOString(),
      summary: 'Lease negotiation playbook',
    }];
    const bundle = await exportSharedSkillsBundle(skills);
    expect(bundle.skills).toHaveLength(1);
    const result = await mergeSharedSkillsBundle(bundle);
    expect(result.merged).toBe(1);
    expect(result.total).toBe(1);
  });
});
