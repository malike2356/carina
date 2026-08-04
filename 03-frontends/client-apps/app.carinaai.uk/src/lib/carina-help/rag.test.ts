import { describe, expect, it } from 'vitest';
import { carinaHelpRagContext, carinaHelpRagStats } from './rag';

describe('carinaHelpRagContext', () => {
  it('indexes knowledge chunks', () => {
    const stats = carinaHelpRagStats();
    expect(stats.chunkCount).toBeGreaterThan(3);
  });

  it('retrieves email-related help', () => {
    const context = carinaHelpRagContext('how do I connect Gmail email to my worker');
    expect(context.toLowerCase()).toMatch(/email|gmail|oauth/);
  });
});
