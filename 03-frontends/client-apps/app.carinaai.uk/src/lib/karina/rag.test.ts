import { describe, expect, it } from 'vitest';
import { karinaRagContext, karinaRagStats } from './rag';

describe('karinaRagContext', () => {
  it('indexes knowledge chunks', () => {
    const stats = karinaRagStats();
    expect(stats.chunkCount).toBeGreaterThan(3);
  });

  it('retrieves email-related help', () => {
    const context = karinaRagContext('how do I connect Gmail email to my worker');
    expect(context.toLowerCase()).toMatch(/email|gmail|oauth/);
  });
});
