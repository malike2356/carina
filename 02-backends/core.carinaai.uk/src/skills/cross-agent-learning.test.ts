import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

const mockConfig = {
  version: 1,
  agents: [
    { id: 'main', name: 'Main', default: true, workspace: '/tmp/main' },
    { id: 'work', name: 'Work', workspace: '/tmp/work' },
  ],
  bindings: [],
  learning: { shareAcrossAgents: { mode: 'kernel', minSuccessCount: 1 } },
};

vi.mock('../workspaces/agent-registry.js', () => ({
  loadAgentsConfig: vi.fn(() => mockConfig),
}));

vi.mock('./store.js', () => ({
  getSkillByName: vi.fn().mockResolvedValue({
    id: 'skill-1',
    name: 'negotiation-tactics',
    description: 'How to negotiate property deals',
    steps: '1. Listen',
    trigger: ['negotiate'],
    toolsUsed: [],
  }),
}));

vi.mock('./learning-events.js', () => ({
  appendLearningEvent: vi.fn().mockResolvedValue('evt-prop-1'),
}));

vi.mock('../sync/agent-sync.js', () => ({
  updateAgentSync: vi.fn().mockResolvedValue({ version: 1, agents: {} }),
}));

describe('cross-agent learning', () => {
  let tmpHome = '';

  beforeEach(async () => {
    tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), 'carina-xagent-'));
    process.env.CARINA_HOME = tmpHome;
    vi.clearAllMocks();
  });

  afterEach(async () => {
    delete process.env.CARINA_HOME;
    await fs.rm(tmpHome, { recursive: true, force: true });
  });

  it('propagates validated skills to sibling agents', async () => {
    const { propagateSkillAcrossAgents, listSharedSkillsForAgent } = await import('./cross-agent-learning.js');
    const result = await propagateSkillAcrossAgents({
      skillName: 'negotiation-tactics',
      sourceAgentId: 'work',
      successCount: 3,
    });

    expect(result.propagated).toBe(true);
    expect(result.targets).toContain('main');

    const shared = await listSharedSkillsForAgent('main');
    expect(shared.some((s) => s.skillName === 'negotiation-tactics')).toBe(true);
  });

  it('respects allowlist policy boundaries', async () => {
    mockConfig.learning = { shareAcrossAgents: { mode: 'allowlist', allowAgents: ['main'] } };
    const { propagateSkillAcrossAgents } = await import('./cross-agent-learning.js');
    const result = await propagateSkillAcrossAgents({
      skillName: 'negotiation-tactics',
      sourceAgentId: 'work',
      successCount: 5,
    });
    expect(result.propagated).toBe(true);
    expect(result.targets).toEqual(['main']);
  });

  it('skips propagation when sharing is disabled', async () => {
    mockConfig.learning = { shareAcrossAgents: { mode: 'off' } };
    const { propagateSkillAcrossAgents } = await import('./cross-agent-learning.js');
    const result = await propagateSkillAcrossAgents({
      skillName: 'negotiation-tactics',
      sourceAgentId: 'work',
      successCount: 5,
    });
    expect(result.propagated).toBe(false);
    expect(result.reason).toBe('sharing_disabled');
  });
});
