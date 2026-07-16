import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const poolQueryMock = vi.fn();
const resolveSessionToolsMock = vi.fn();
const getChannelStatusReportsMock = vi.fn();
const getActivePackNamesMock = vi.fn();
const getActiveExtensionsMock = vi.fn();
const getWorkspaceRagStatusMock = vi.fn();
const getAggregateCredentialStatusMock = vi.fn();
const getSubscriptionStatusMock = vi.fn();
const getAivaScoutWorkspaceMock = vi.fn();

vi.mock('../memory/db.js', () => ({
  pool: { query: (...args: unknown[]) => poolQueryMock(...args) },
}));

vi.mock('../tools/session-tool-resolution.js', () => ({
  resolveSessionTools: (...args: unknown[]) => resolveSessionToolsMock(...args),
}));

vi.mock('../gateway/channels/channel-status.js', () => ({
  getChannelStatusReports: () => getChannelStatusReportsMock(),
}));

vi.mock('../skills/index.js', () => ({
  getActivePackNames: () => getActivePackNamesMock(),
}));

vi.mock('../extensions/registry.js', () => ({
  getActiveExtensions: (...args: unknown[]) => getActiveExtensionsMock(...args),
}));

vi.mock('../rag/status.js', () => ({
  getWorkspaceRagStatus: (...args: unknown[]) => getWorkspaceRagStatusMock(...args),
}));

vi.mock('./credential-status.js', () => ({
  getAggregateCredentialStatus: () => getAggregateCredentialStatusMock(),
}));

vi.mock('../workers/aiva-subscription-store.js', () => ({
  getSubscriptionStatus: (...args: unknown[]) => getSubscriptionStatusMock(...args),
}));

vi.mock('../billing/aiva-scout-store.js', () => ({
  getAivaScoutWorkspace: (...args: unknown[]) => getAivaScoutWorkspaceMock(...args),
}));

vi.mock('../tools/registry.js', () => ({
  registry: {
    list: () => [
      { name: 'web-search', description: 'Search the web' },
      { name: 'file-read', description: 'Read files' },
      { name: 'shell', description: 'Run shell' },
      { name: 'memory', description: 'Memory' },
      { name: 'calendar', description: 'Calendar' },
    ],
    getMeta: () => null,
  },
  inferToolset: (name: string) => name.split('-')[0] ?? 'tools',
}));

vi.mock('../security/tool-execution-context.js', () => ({
  getToolExecutionContext: () => ({ orgRole: 'owner', planMode: false }),
}));

vi.mock('../security/plan-mode-state.js', () => ({
  resolvePlanMode: () => false,
}));

vi.mock('../credentials/resolver.js', () => ({
  resolveCredential: async () => 'mock-key',
}));

describe('buildCapabilityManifest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    poolQueryMock.mockResolvedValue({ rows: [] });
    resolveSessionToolsMock.mockResolvedValue({
      names: ['web-search', 'file-read'],
      tools: [
        { name: 'web-search', description: 'Search the web' },
        { name: 'file-read', description: 'Read files' },
      ],
      isSubagent: false,
      toolsets: ['web', 'file'],
      embeddingFiltered: true,
    });
    getChannelStatusReportsMock.mockReturnValue([
      { channel: 'telegram', state: 'connected', active: true, env: [] },
      { channel: 'email', state: 'disabled', active: false, env: [] },
    ]);
    getActivePackNamesMock.mockReturnValue(['productivity']);
    getActiveExtensionsMock.mockResolvedValue([]);
    getWorkspaceRagStatusMock.mockResolvedValue({
      documentCount: 2,
      domains: ['general', 'hr'],
      totalTokens: 1200,
      lastUpdated: '2026-07-09T12:00:00.000Z',
    });
    getAggregateCredentialStatusMock.mockResolvedValue({
      configured: ['tavily'],
      missing: ['twilio'],
      degraded: [],
    });
    getSubscriptionStatusMock.mockResolvedValue({
      planTier: 'starter',
      aivasUsed: 1,
    });
    getAivaScoutWorkspaceMock.mockResolvedValue({
      scoutStatus: 'connected',
      scoutLastHeartbeatAt: new Date('2026-07-09T11:00:00.000Z'),
    });
  });

  afterEach(async () => {
    const { clearManifestCacheForTests } = await import('./manifest-builder.js');
    clearManifestCacheForTests();
  });

  it('builds manifest with active tool count and embedding filtered reasons', async () => {
    const { buildCapabilityManifest } = await import('./manifest-builder.js');
    const manifest = await buildCapabilityManifest({
      sessionId: 'sess-1',
      workspaceId: 'ws-1',
      platform: 'web',
      userMessage: 'what can you do?',
      forceRefresh: true,
    });

    expect(manifest.summary.totalToolsActive).toBe(2);
    expect(manifest.summary.totalToolsAvailable).toBeGreaterThan(2);
    expect(manifest.summary.totalRagDocuments).toBe(2);
    expect(manifest.summary.ragDomains).toEqual(['general', 'hr']);
    expect(manifest.tools.categories.web).toBe(1);
    expect(Object.values(manifest.tools.inactiveReason)).toContain('embedding_filtered');
    expect(manifest.platform.tierLabel).toBe('Starter');
    expect(manifest.scout.connected).toBe(true);
  });

  it('builds prompt block under token budget with active count', async () => {
    const { buildCapabilityManifest } = await import('./manifest-builder.js');
    const { buildCapabilityPromptBlock } = await import('./prompt-injection.js');
    const manifest = await buildCapabilityManifest({
      sessionId: 'sess-2',
      workspaceId: null,
      platform: 'cli',
      forceRefresh: true,
    });
    const block = buildCapabilityPromptBlock(manifest);

    expect(block).toContain('YOUR CAPABILITIES');
    expect(block).toContain(`${manifest.summary.totalToolsActive} tools active`);
    expect(block.length).toBeLessThanOrEqual(2200);
    expect(block).not.toContain('233 tools');
  });
});
