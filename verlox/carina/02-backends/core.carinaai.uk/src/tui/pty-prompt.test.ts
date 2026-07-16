import { afterEach, describe, expect, it } from 'vitest';
import { closePtyPromptInterface, isOpsPtyMode } from './pty-prompt.js';

describe('pty-prompt', () => {
  afterEach(async () => {
    delete process.env.CARINA_OPS_PTY;
    await closePtyPromptInterface();
  });

  it('detects ops PTY mode from env', () => {
    expect(isOpsPtyMode()).toBe(false);
    process.env.CARINA_OPS_PTY = '1';
    expect(isOpsPtyMode()).toBe(true);
  });
});
