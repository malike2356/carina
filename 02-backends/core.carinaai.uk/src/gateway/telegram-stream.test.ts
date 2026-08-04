import { describe, expect, it } from 'vitest';
import { BlockStreamAssembler } from './block-stream-assembler.js';

/**
 * Regression: streamToTelegram must send assembler tail even when no paragraph
 * break flushed blocks during streaming (see telegram.ts streamToTelegram).
 */
describe('telegram block stream tail', () => {
  it('keeps single-line replies in buffer until flush', () => {
    const assembler = new BlockStreamAssembler();
    const streamed = assembler.push('Hi there!');
    expect(streamed.blocks).toEqual([]);

    const tail = assembler.flush();
    expect(tail).toBe('Hi there!');
    expect(tail.trim().length).toBeGreaterThan(0);
  });
});
