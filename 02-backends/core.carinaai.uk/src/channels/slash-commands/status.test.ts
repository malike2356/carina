import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../workers/worker-store.js', () => ({
  getWorkerById: vi.fn(),
}));
vi.mock('../../ingestion/social/social-settings-store.js', () => ({
  getSocialSettings: vi.fn(),
}));
vi.mock('../../memory/aiva/memory-commands.js', () => ({
  statusAivaConversation: vi.fn(),
}));

import { getWorkerById } from '../../workers/worker-store.js';
import { getSocialSettings } from '../../ingestion/social/social-settings-store.js';
import { statusAivaConversation } from '../../memory/aiva/memory-commands.js';
import { statusCommand } from './status.js';
import type { InboundMessage } from '../types.js';

function msg(content: string): InboundMessage {
  return {
    channel: 'telegram',
    workerId: 'worker-1',
    workspaceId: 'ws-1',
    contactId: 'chat-1',
    content,
    rawPayload: {},
    timestamp: new Date(),
  };
}

describe('friendly status command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getWorkerById).mockResolvedValue({
      id: 'worker-1',
      name: 'Randy',
      status: 'active',
      workerConfig: { telegram: { preferVoiceReplies: false } },
    } as never);
    vi.mocked(getSocialSettings).mockResolvedValue({
      socialRequireApproval: false,
      socialAutoReplyEnabled: false,
      socialAutoReplyAllowlist: [],
    });
    vi.mocked(statusAivaConversation).mockResolvedValue({
      episodicTurns: 2,
    } as never);
  });

  it('returns plain-language owner status by default', async () => {
    const output = await statusCommand.handler(msg('/status'), 'worker-1');
    expect(output).toContain('Randy is online and ready.');
    expect(output).toContain('Voice replies: off');
    expect(output).toContain('Chat approvals: off');
    expect(output).toContain('/status tech');
    expect(output).not.toContain('Active toolsets:');
    expect(output).not.toContain('Embedding:');
  });
});
