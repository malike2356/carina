import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { publishSharedSkillsToStore, listSharedSkillsFromStore } from './shared-skills-store.js';

describe('shared-skills-store', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-hub-store-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('publishes and lists shared skills', async () => {
    const published = await publishSharedSkillsToStore(tmpDir, {
      version: 1,
      exportedAt: new Date().toISOString(),
      sourceWorkspace: 'test',
      skills: [{
        skillName: 'demo-skill',
        skillId: '1',
        sourceAgentId: 'main',
        targetAgentIds: ['secondary'],
        propagatedAt: new Date().toISOString(),
        summary: 'demo',
      }],
    });
    expect(published).toBe(1);
    const rows = await listSharedSkillsFromStore(tmpDir);
    expect(rows[0]?.skillName).toBe('demo-skill');
  });
});
