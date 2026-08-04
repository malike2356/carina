import { describe, expect, it } from 'vitest';
import { printCliOutput, resolveOutputMode } from './json-output.js';
import { startProgress } from './progress.js';

describe('cli json output', () => {
  it('detects json mode from args', () => {
    expect(resolveOutputMode(['list', '--json'])).toBe('json');
    expect(resolveOutputMode(['list'])).toBe('pretty');
  });

  it('prints json payloads', () => {
    const lines: string[] = [];
    const orig = console.log;
    console.log = (msg: string) => lines.push(msg);
    try {
      printCliOutput({ ok: true }, 'json');
      expect(lines[0]).toContain('"ok": true');
    } finally {
      console.log = orig;
    }
  });
});

describe('cli progress', () => {
  it('returns a stoppable handle', () => {
    const handle = startProgress('Working');
    expect(handle.update).toBeTypeOf('function');
    handle.stop();
  });
});
