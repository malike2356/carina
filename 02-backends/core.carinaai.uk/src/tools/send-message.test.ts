import { describe, expect, it, vi, beforeEach } from 'vitest';

const { findContactMock, getByNameMock } = vi.hoisted(() => {
  const findContactMock = vi.fn();
  const getByNameMock = vi.fn();
  return { findContactMock, getByNameMock };
});

vi.mock('../profiles/contacts.js', () => ({
  findContact: findContactMock,
  loadAllContacts: vi.fn(async () => []),
  saveContactsToFile: vi.fn(async () => undefined),
  loadContactsFromFile: vi.fn(async () => []),
}));

vi.mock('../workers/worker-session-context.js', () => ({
  getWorkerSessionContext: vi.fn(() => undefined),
}));

vi.mock('../gateway/channels/channel-registry.js', () => ({
  channelRegistry: {
    getByName: getByNameMock,
  },
}));

function makeAdapter(overrides: Partial<{ enabled: boolean; sendMessage: () => Promise<void> }> = {}): object {
  return {
    enabled: true,
    sendMessage: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  findContactMock.mockResolvedValue([]);
  getByNameMock.mockReturnValue(undefined);
});

describe('send-message tool', () => {
  it('returns error when text is empty', async () => {
    const { sendMessageTool } = await import('./send-message.js');
    const result = await sendMessageTool.execute({ text: '' }) as { error?: string };
    expect(result.error).toContain('text is required');
  });

  it('returns error when channel and contact_name are both absent', async () => {
    const { sendMessageTool } = await import('./send-message.js');
    const result = await sendMessageTool.execute({
      text: 'hello',
      conversation_id: 'ab',
    }) as { error?: string };
    expect(result.error).toContain('channel');
  });

  it('returns error when conversation_id is missing without contact_name', async () => {
    const { sendMessageTool } = await import('./send-message.js');
    const result = await sendMessageTool.execute({
      text: 'hello',
      channel: 'telegram',
    }) as { error?: string };
    expect(result.error).toContain('conversation_id');
  });

  it('returns error when contact_name is not found', async () => {
    findContactMock.mockResolvedValue([]);
    const { sendMessageTool } = await import('./send-message.js');
    const result = await sendMessageTool.execute({
      text: 'hello',
      contact_name: 'Nobody',
    }) as { error?: string };
    expect(result.error).toContain('contact not found');
  });

  it('returns error when contact has no messaging channel', async () => {
    findContactMock.mockResolvedValue([{ name: 'Alice', id: '1', source: 'carina' }]);
    const { sendMessageTool } = await import('./send-message.js');
    const result = await sendMessageTool.execute({
      text: 'hello',
      contact_name: 'Alice',
    }) as { error?: string };
    expect(result.error).toContain('no messaging channel');
  });

  it('returns error when channel adapter is not loaded', async () => {
    getByNameMock.mockReturnValue(undefined);
    const { sendMessageTool } = await import('./send-message.js');
    const result = await sendMessageTool.execute({
      text: 'hello',
      channel: 'telegram',
      conversation_id: '12345',
    }) as { error?: string };
    expect(result.error).toMatch(/not loaded|not registered|Telegram/);
  });

  it('returns error when channel adapter is not enabled', async () => {
    getByNameMock.mockReturnValue(makeAdapter({ enabled: false }));
    const { sendMessageTool } = await import('./send-message.js');
    const result = await sendMessageTool.execute({
      text: 'hello',
      channel: 'telegram',
      conversation_id: '12345',
    }) as { error?: string };
    expect(result.error).toContain('not enabled');
  });

  it('returns error when sendMessage throws', async () => {
    const adapter = makeAdapter({
      sendMessage: vi.fn().mockRejectedValue(new Error('network timeout')),
    } as { sendMessage: () => Promise<never> });
    getByNameMock.mockReturnValue(adapter);
    const { sendMessageTool } = await import('./send-message.js');
    const result = await sendMessageTool.execute({
      text: 'hello',
      channel: 'telegram',
      conversation_id: '12345',
    }) as { error?: string };
    expect(result.error).toContain('network timeout');
  });

  it('returns sent:true on success with direct channel+conversation_id', async () => {
    getByNameMock.mockReturnValue(makeAdapter());
    const { sendMessageTool } = await import('./send-message.js');
    const result = await sendMessageTool.execute({
      text: 'hello',
      channel: 'telegram',
      conversation_id: '12345',
    }) as { sent?: boolean; channel?: string; conversation_id?: string };
    expect(result.sent).toBe(true);
    expect(result.channel).toBe('telegram');
    expect(result.conversation_id).toBe('12345');
  });

  it('resolves contact and sends via telegram', async () => {
    findContactMock.mockResolvedValue([{
      id: '1', name: 'Alice', telegram: '67890', source: 'carina',
    }]);
    getByNameMock.mockReturnValue(makeAdapter());
    const { sendMessageTool } = await import('./send-message.js');
    const result = await sendMessageTool.execute({
      text: 'hi Alice',
      contact_name: 'Alice',
    }) as { sent?: boolean; channel?: string };
    expect(result.sent).toBe(true);
    expect(result.channel).toBe('telegram');
  });

  it('returns error when findContact throws unexpectedly', async () => {
    findContactMock.mockRejectedValue(new Error('EACCES: permission denied'));
    const { sendMessageTool } = await import('./send-message.js');
    const result = await sendMessageTool.execute({
      text: 'hello',
      contact_name: 'Alice',
    }) as { error?: string };
    expect(result.error).toContain('EACCES');
  });
});
