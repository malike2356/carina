import { describe, expect, it } from 'vitest';
import {
  buildCarinaIdentityBlock,
  buildDefaultAgentIdentity,
  buildDefaultSoulFallback,
} from './identity-defaults.js';

describe('identity-defaults', () => {
  it('includes default agent identity fallback (ASP-12)', () => {
    const block = buildDefaultAgentIdentity('Carina');
    expect(block).toContain('intelligent AI assistant created by VERLOX Ltd');
    expect(block).toContain('Be targeted and efficient in your exploration and investigations');
    expect(buildCarinaIdentityBlock()).toContain('intelligent AI assistant created by VERLOX Ltd');
  });

  it('includes default soul philosophy (KPB-07)', () => {
    const soul = buildDefaultSoulFallback();
    expect(soul).toContain('Be genuinely helpful, not performatively helpful');
    expect(soul).toContain('Have opinions');
    expect(buildCarinaIdentityBlock()).toContain('DREAMS.md');
  });
});
