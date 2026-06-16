import { describe, expect, it } from 'vitest';
import { buildCarinaIdentityBlock } from './identity-defaults.js';

describe('buildCarinaIdentityBlock', () => {
  it('defines a non-corporate default voice', () => {
    const block = buildCarinaIdentityBlock();
    expect(block).toContain('Default identity:');
    expect(block).toContain('genuinely helpful');
    expect(block).toContain('SOUL.md and IDENTITY.md');
    expect(block).not.toContain('maintain professionalism');
  });
});
