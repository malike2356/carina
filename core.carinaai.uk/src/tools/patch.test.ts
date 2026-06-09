import { describe, expect, it, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { patchTool } from './patch.js';

let tmpDir: string;

async function setup(): Promise<string> {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'carina-patch-test-'));
  return tmpDir;
}

afterEach(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('patch', () => {
  it('replaces exact match', async () => {
    await setup();
    const file = path.join(tmpDir, 'sample.txt');
    await fs.writeFile(file, 'hello world\nsecond line');

    const result = await patchTool.execute({
      path: file,
      old_string: 'hello world',
      new_string: 'goodbye world',
    }) as Record<string, unknown>;

    expect(result.strategy).toBe('exact');
    expect(result.replacements).toBe(1);
    const content = await fs.readFile(file, 'utf8');
    expect(content).toBe('goodbye world\nsecond line');
    expect(String(result.diff)).toContain('-hello world');
    expect(String(result.diff)).toContain('+goodbye world');
  });

  it('rejects ambiguous matches when replace_all is false', async () => {
    await setup();
    const file = path.join(tmpDir, 'dup.txt');
    await fs.writeFile(file, 'foo bar foo');

    const result = await patchTool.execute({
      path: file,
      old_string: 'foo',
      new_string: 'baz',
    }) as Record<string, unknown>;

    expect(result.error).toContain('matches 2 locations');
  });

  it('replaces all when replace_all is true', async () => {
    await setup();
    const file = path.join(tmpDir, 'all.txt');
    await fs.writeFile(file, 'foo bar foo');

    const result = await patchTool.execute({
      path: file,
      old_string: 'foo',
      new_string: 'baz',
      replace_all: true,
    }) as Record<string, unknown>;

    expect(result.replacements).toBe(2);
    const content = await fs.readFile(file, 'utf8');
    expect(content).toBe('baz bar baz');
  });

  it('handles crlf-normalized fuzzy variant', async () => {
    await setup();
    const file = path.join(tmpDir, 'crlf.txt');
    await fs.writeFile(file, 'hello\r\nworld');

    const result = await patchTool.execute({
      path: file,
      old_string: 'hello\nworld',
      new_string: 'hi\nworld',
    }) as Record<string, unknown>;

    expect(result.strategy).toBe('lf-to-crlf');
    const content = await fs.readFile(file, 'utf8');
    expect(content).toBe('hi\nworld');
  });

  it('flags new JSON syntax errors', async () => {
    await setup();
    const file = path.join(tmpDir, 'data.json');
    await fs.writeFile(file, '{"ok": true}');

    const result = await patchTool.execute({
      path: file,
      old_string: 'true',
      new_string: 'TRUE',
    }) as Record<string, unknown>;

    expect(result.syntax_errors).toBeDefined();
  });
});
