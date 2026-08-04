import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  deleteCustomResource,
  listCustomResources,
  saveCustomResource,
} from './user-resources.js';

const tmpDirs: string[] = [];

async function makeTmpDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'carina-resources-'));
  tmpDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tmpDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe('user-resources custom upload', () => {
  it('saves and lists skill JSON files', async () => {
    const base = await makeTmpDir();
    const content = JSON.stringify({
      name: 'my-workflow',
      description: 'Test skill',
      trigger: ['test'],
      steps: '1. Do thing.',
    });
    await saveCustomResource('skill', 'my-workflow.json', content, base);
    const files = await listCustomResources(base);
    expect(files).toHaveLength(1);
    expect(files[0].kind).toBe('skill');
    expect(files[0].name).toBe('my-workflow.json');
  });

  it('rejects invalid skill extensions', async () => {
    const base = await makeTmpDir();
    await expect(
      saveCustomResource('skill', 'notes.txt', '{}', base),
    ).rejects.toThrow(/must be \.json/);
  });

  it('deletes custom resources', async () => {
    const base = await makeTmpDir();
    await saveCustomResource('knowledge', 'notes.md', '# Hello', base);
    await deleteCustomResource('knowledge', 'notes.md', base);
    const files = await listCustomResources(base);
    expect(files).toHaveLength(0);
  });
});
