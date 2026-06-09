import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  appendSharedMemory,
  importInboundMedia,
  importWorkspaceFiles,
  readSharedMemory,
  updateAgentSync,
  readAgentSync,
} from './agent-sync.js';

describe('agent-sync', () => {
  let tmp = '';

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'carina-sync-'));
    process.env.CARINA_HOME = tmp;
  });

  afterEach(async () => {
    delete process.env.CARINA_HOME;
    delete process.env.CARINA_IMPORT_WORKSPACE_FROM;
    delete process.env.CARINA_IMPORT_MEDIA_FROM;
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('writes and reads shared memory', async () => {
    await appendSharedMemory('carina', 'Landlord called about Unit 4.');
    const content = await readSharedMemory();
    expect(content).toContain('Landlord called');
  });

  it('updates agent-sync.json', async () => {
    await updateAgentSync('work-profile', { summary: 'Daily briefing sent', facts: ['3 emails triaged'] });
    const sync = await readAgentSync();
    expect(sync.agents['work-profile'].summary).toContain('briefing');
    expect(sync.agents['work-profile'].facts).toContain('3 emails triaged');
  });

  it('imports workspace files from a configured directory', async () => {
    const src = path.join(tmp, 'import-src');
    await fs.mkdir(src, { recursive: true });
    await fs.writeFile(path.join(src, 'AGENTS.md'), '# Rules\n', 'utf8');
    process.env.CARINA_IMPORT_WORKSPACE_FROM = src;

    const result = await importWorkspaceFiles();
    expect(result.imported).toContain('AGENTS.md');
    const dest = await fs.readFile(path.join(tmp, 'AGENTS.md'), 'utf8');
    expect(dest).toContain('Rules');
  });

  it('imports inbound media without overwriting', async () => {
    const src = path.join(tmp, 'media-src');
    await fs.mkdir(src, { recursive: true });
    await fs.writeFile(path.join(src, 'voice.ogg'), 'audio', 'utf8');
    process.env.CARINA_IMPORT_MEDIA_FROM = src;

    const first = await importInboundMedia();
    expect(first.imported).toEqual(['voice.ogg']);
    expect(first.skipped).toBe(0);

    const second = await importInboundMedia();
    expect(second.imported).toEqual([]);
    expect(second.skipped).toBe(1);
  });
});
