import { describe, expect, it } from 'vitest';
import { BlockStreamAssembler } from './block-stream-assembler.js';

describe('block-stream-assembler', () => {
  it('flushes on paragraph breaks', () => {
    const assembler = new BlockStreamAssembler();
    const first = assembler.push('Hello\n\n');
    expect(first.blocks.join('')).toBe('Hello\n\n');
    const second = assembler.push('World');
    expect(second.blocks).toEqual([]);
    expect(assembler.flush()).toBe('World');
  });

  it('preserves blank lines when joining flushed blocks', () => {
    const assembler = new BlockStreamAssembler();
    const joined = [
      ...assembler.push('First paragraph.\n\n').blocks,
      ...assembler.push('Second paragraph.\n\n').blocks,
      assembler.flush(),
    ].join('');

    expect(joined).toBe('First paragraph.\n\nSecond paragraph.\n\n');
  });
});
