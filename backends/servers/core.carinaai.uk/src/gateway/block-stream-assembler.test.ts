import { describe, expect, it } from 'vitest';
import { BlockStreamAssembler } from './block-stream-assembler.js';

describe('block-stream-assembler', () => {
  it('flushes on paragraph breaks', () => {
    const assembler = new BlockStreamAssembler();
    const first = assembler.push('Hello\n\n');
    expect(first.blocks.join('')).toContain('Hello');
    const second = assembler.push('World');
    expect(second.blocks).toEqual([]);
    expect(assembler.flush()).toContain('World');
  });
});
