import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../brain/llm.js', () => ({
  llm: {
    list: () => ['deepseek', 'anthropic'],
  },
}));

describe('session-control', () => {
  beforeEach(() => {
    delete process.env.CARINA_OPERATOR_SESSION;
  });

  afterEach(() => {
    delete process.env.CARINA_OPERATOR_SESSION;
  });

  it('formats compact messenger help for telegram', async () => {
    const { formatMessengerHelp } = await import('./session-control.js');
    const compact = formatMessengerHelp('full help text', 'telegram');
    expect(compact).toContain('/new');
    expect(compact).toContain('/stop');
    expect(compact).not.toContain('full help text');
  });

  it('includes continuity mode in status reply', async () => {
    process.env.CARINA_OPERATOR_SESSION = 'true';
    const { formatGatewayStatusReply } = await import('./session-control.js');
    const reply = formatGatewayStatusReply({
      sessionId: 'sess-1234567890',
      channel: 'telegram',
      activeProvider: 'deepseek',
      activeModel: 'deepseek-chat',
    });
    expect(reply).toContain('unified operator session');
    expect(reply).toContain('deepseek');
  });
});
