import { describe, expect, it, afterEach, vi, beforeEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { fileReadTool, fileWriteTool } from './file.js';

let tmpDir: string;

async function setup(): Promise<string> {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'carina-file-test-'));
  return tmpDir;
}

afterEach(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('file-read', () => {
  it('reads an existing file', async () => {
    await setup();
    const file = path.join(tmpDir, 'test.txt');
    await fs.writeFile(file, 'hello world');
    const result = await fileReadTool.execute({ path: file });
    expect(result).toBe('hello world');
  });

  it('returns error string for missing file', async () => {
    const result = await fileReadTool.execute({ path: '/tmp/__nonexistent_carina__.txt' });
    expect(typeof result).toBe('string');
    expect(result as string).toContain('Error');
  });

  it('blocks path traversal', async () => {
    const result = await fileReadTool.execute({ path: '/tmp/../../etc/passwd' });
    expect(result as string).toContain('Error');
  });

  it('blocks /etc paths', async () => {
    const result = await fileReadTool.execute({ path: '/etc/passwd' });
    expect(result as string).toContain('Error');
  });

  it('returns truncation notice for large files', async () => {
    await setup();
    const file = path.join(tmpDir, 'large.txt');
    await fs.writeFile(file, Buffer.alloc(110 * 1024, 'a'));
    const result = await fileReadTool.execute({ path: file }) as string;
    expect(result).toContain('[truncated');
  });

  it('returns error for directories', async () => {
    await setup();
    const result = await fileReadTool.execute({ path: tmpDir }) as string;
    expect(result).toContain('Error');
  });
});

describe('file-read honeypot integration', () => {
  const originalEnabled = process.env.LABYRINTH_ENABLED;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    process.env.LABYRINTH_ENABLED = 'true';
  });

  afterEach(() => {
    process.env.LABYRINTH_ENABLED = originalEnabled;
  });

  it('blocks read on honeypot path without reading file', async () => {
    vi.doMock('../security/honeypot-client.js', () => ({
      checkHoneypotFilePath: vi.fn().mockResolvedValue(true),
    }));
    const readFileSpy = vi.spyOn(fs, 'readFile');

    const { fileReadTool: readTool } = await import('./file.js');
    const result = await readTool.execute({ path: '/tmp/.carina-backup.key' });

    expect(result).toMatchObject({
      error: '[Access Denied: This path is monitored by Labyrinth]',
    });
    expect(readFileSpy).not.toHaveBeenCalled();
    readFileSpy.mockRestore();
  });
});

describe('file-write', () => {
  it('writes content to a new file', async () => {
    await setup();
    const file = path.join(tmpDir, 'output.txt');
    await fileWriteTool.execute({ path: file, content: 'written by carina' });
    const read = await fs.readFile(file, 'utf8');
    expect(read).toBe('written by carina');
  });

  it('creates parent directories recursively', async () => {
    await setup();
    const file = path.join(tmpDir, 'a', 'b', 'c', 'deep.txt');
    await fileWriteTool.execute({ path: file, content: 'deep' });
    const read = await fs.readFile(file, 'utf8');
    expect(read).toBe('deep');
  });

  it('blocks writes to /etc', async () => {
    const result = await fileWriteTool.execute({ path: '/etc/cron.d/carina', content: 'x' });
    expect(result as string).toContain('Error');
  });

  it('blocks path traversal on write', async () => {
    const result = await fileWriteTool.execute({
      path: '/tmp/../../etc/evil',
      content: 'x',
    });
    expect(result as string).toContain('Error');
  });

  it('needsConfirmation returns true when file exists', async () => {
    await setup();
    const file = path.join(tmpDir, 'existing.txt');
    await fs.writeFile(file, 'original');
    const needs = await fileWriteTool.needsConfirmation!({ path: file, content: 'new' });
    expect(needs).toBe(true);
  });

  it('needsConfirmation returns false for new file', async () => {
    await setup();
    const file = path.join(tmpDir, 'brand-new.txt');
    const needs = await fileWriteTool.needsConfirmation!({ path: file, content: 'x' });
    expect(needs).toBe(false);
  });
});
