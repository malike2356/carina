import { beforeEach, describe, expect, it, vi } from 'vitest';

const buildCapabilityManifestMock = vi.fn();
const getActivePackNamesMock = vi.fn(() => ['productivity']);
const resolveCredentialMock = vi.fn(async () => 'ok');

vi.mock('../capabilities/manifest-builder.js', () => ({
  buildCapabilityManifest: (...args: unknown[]) => buildCapabilityManifestMock(...args),
}));

vi.mock('../capabilities/prompt-injection.js', () => ({
  buildCapabilityPromptBlock: () => '## YOUR CAPABILITIES\nactive',
}));

vi.mock('../skills/index.js', () => ({
  getActivePackNames: () => getActivePackNamesMock(),
}));

vi.mock('../credentials/resolver.js', () => ({
  resolveCredential: (...args: unknown[]) => resolveCredentialMock(...args),
}));

vi.mock('../credentials/tool-capabilities.js', () => ({
  TOOL_CAPABILITIES: [
    { tool_name: 'web_search', category: 'search', required_credentials: ['OPENAI_API_KEY'] },
  ],
}));

describe('list_live_capabilities', () => {
  beforeEach(() => {
    vi.resetModules();
    buildCapabilityManifestMock.mockReset();
    getActivePackNamesMock.mockReturnValue(['productivity']);
    resolveCredentialMock.mockResolvedValue('ok');
    buildCapabilityManifestMock.mockResolvedValue({
      generatedAt: '2026-07-19T12:00:00.000Z',
      summary: {
        totalToolsActive: 12,
        totalToolsAvailable: 200,
        totalSkillsActive: 3,
        totalChannelsConnected: 1,
        totalExtensionsActive: 0,
        totalRagDocuments: 8,
        ragDomains: ['platform', 'policy'],
      },
      tools: {
        active: [{ name: 'web_search' }],
        inactiveReason: {},
        categories: { web: 1 },
      },
      channels: {
        connected: [{ name: 'web' }],
        available: [{ name: 'telegram' }],
      },
      skills: { active: [{ name: 'summarize' }], categories: {} },
      knowledge: { documentCount: 8, domains: ['platform'], totalTokens: 1000, lastUpdated: null },
      credentials: { configured: ['OPENAI_API_KEY'], missing: [] },
      platform: { tierLabel: 'Pro', slotsUsed: 1, slotLimit: 5 },
      scout: { connected: false },
    });
  });

  it('returns a live capability snapshot', async () => {
    const { listLiveCapabilitiesTool } = await import('./list-live-capabilities.js');
    const result = await listLiveCapabilitiesTool.execute({
      workspaceId: 'ws_1',
      includePromptBlock: true,
    });

    expect(buildCapabilityManifestMock).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: 'ws_1', forceRefresh: true }),
    );
    expect(result.summary.activeTools).toBe(12);
    expect(result.summary.catalogTools).toBe(200);
    expect(result.summary.alwaysRetrievableRagPacks).toContain('carina-rag');
    expect(result.toolsByCategory).toEqual({ web: 1 });
    expect(result.activeToolNames).toEqual(['web_search']);
    expect(result.promptBlock).toContain('YOUR CAPABILITIES');
    expect(result.channels.connected).toEqual(['web']);
  });
});
