import { afterEach, describe, expect, it, vi } from 'vitest';
import { capabilityGate, clearCapabilityGateStateForTests } from './capability-gate.js';
import { emptyManifest } from './capability-manifest.js';
import { checkTierGate } from './tier-gates.js';
import { formatRejection } from './rejection-messages.js';
import { registry } from '../tools/index.js';

describe('tier-gates', () => {
  it('blocks starter from business-only tools', () => {
    expect(checkTierGate('api-call', 'starter')).toBe('business');
    expect(checkTierGate('api-call', 'business')).toBeNull();
  });
});

describe('capability-gate', () => {
  afterEach(() => {
    clearCapabilityGateStateForTests();
    vi.restoreAllMocks();
  });

  it('rejects unknown tools with actionable message', async () => {
    const manifest = emptyManifest('sess-1');
    const result = await capabilityGate('not-a-real-tool-xyz', {}, manifest, 'sess-1');
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason.code).toBe('TOOL_NOT_FOUND');
      expect(formatRejection(result)).toContain('plain English');
    }
  });

  it('rejects inactive tools with credential guidance', async () => {
    const manifest = emptyManifest('sess-1');
    manifest.tools.active = [];
    manifest.tools.inactiveReason['email-send'] = 'credential_missing';
    vi.spyOn(registry, 'get').mockReturnValue({
      name: 'email-send',
      description: 'Send email',
      parameters: { type: 'object', properties: {} },
      execute: async () => ({}),
    });
    const result = await capabilityGate('email-send', {}, manifest, 'sess-1');
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason.code).toBe('TOOL_INACTIVE');
      expect(result.fix).toContain('Settings');
    }
  });

  it('rejects tier-gated tools', async () => {
    const manifest = emptyManifest('sess-1');
    manifest.platform.tier = 'starter';
    manifest.tools.active.push({
      name: 'api-call',
      description: 'Call external API',
      category: 'integrations',
      credentialRequired: null,
      credentialStatus: 'ready',
      riskClass: 'safe',
      requiresConfirmation: false,
    });
    vi.spyOn(registry, 'get').mockReturnValue({
      name: 'api-call',
      description: 'Call external API',
      parameters: { type: 'object', properties: {} },
      execute: async () => ({}),
    });
    const result = await capabilityGate('api-call', {}, manifest, 'sess-1');
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason.code).toBe('TIER_GATED');
      expect(result.explanation).toContain('Business');
    }
  });
});
