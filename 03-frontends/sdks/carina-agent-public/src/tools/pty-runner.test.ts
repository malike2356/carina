import { describe, expect, it, afterEach } from 'vitest';
import { isPtyEnabled } from './pty-runner.js';

const original = process.env.CARINA_PTY_ENABLED;

afterEach(() => {
  process.env.CARINA_PTY_ENABLED = original;
});

describe('pty-runner', () => {
  it('is disabled by default', () => {
    delete process.env.CARINA_PTY_ENABLED;
    expect(isPtyEnabled()).toBe(false);
  });

  it('is enabled when env flag is true', () => {
    process.env.CARINA_PTY_ENABLED = 'true';
    expect(isPtyEnabled()).toBe(true);
  });
});
