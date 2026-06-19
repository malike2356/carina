import { describe, expect, it } from 'vitest';
import {
  buildCarinaIdentityBlock,
  buildHermesDefaultAgentIdentity,
  buildOpenClawSoulFallback,
} from './identity-defaults.js';

describe('identity-defaults', () => {
  it('includes Hermes DEFAULT_AGENT_IDENTITY fallback (ASP-12)', () => {
    const block = buildHermesDefaultAgentIdentity('Carina');
    expect(block).toContain('intelligent AI assistant created by VERLOX Ltd');
    expect(block).toContain('Be targeted and efficient in your exploration and investigations');
    expect(buildCarinaIdentityBlock()).toContain('intelligent AI assistant created by VERLOX Ltd');
  });

  it('includes OpenClaw soul philosophy (KPB-07)', () => {
    const soul = buildOpenClawSoulFallback();
    expect(soul).toContain('Be genuinely helpful, not performatively helpful');
    expect(soul).toContain('Have opinions');
    expect(buildCarinaIdentityBlock()).toContain('DREAMS.md');
  });
});
