import { describe, expect, it, vi, beforeEach } from 'vitest';
import { telegramAdapter } from './telegram-adapter.js';

describe('telegramAdapter voice intent', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('strips voice directives and marks preferAudio', () => {
    const inbound = telegramAdapter.parse(
      {
        message: {
          message_id: 42,
          text:
            'give me summary of boreholes in my drive and i need the response in audio format - not text. put it here in telegram',
          date: 1_700_000_000,
          from: { id: 9, first_name: 'Laud' },
          chat: { id: 9, type: 'private' },
        },
      },
      'worker-1',
      'ws-1',
    );

    expect(inbound).not.toBeNull();
    expect(inbound?.metadata?.preferAudio).toBe('true');
    expect(inbound?.content.toLowerCase()).toContain('boreholes');
    expect(inbound?.content.toLowerCase()).not.toContain('audio format');
    expect(inbound?.content.toLowerCase()).not.toContain('put it here in telegram');
  });

  it('detects summarise ... in voice audio', () => {
    const inbound = telegramAdapter.parse(
      {
        message: {
          message_id: 43,
          text: 'summarise my google drive content to me here in voice audio',
          date: 1_700_000_000,
          from: { id: 9, first_name: 'Laud' },
          chat: { id: 9, type: 'private' },
        },
      },
      'worker-1',
      'ws-1',
    );

    expect(inbound?.metadata?.preferAudio).toBe('true');
    expect(inbound?.content.toLowerCase()).toContain('google drive');
    expect(inbound?.content.toLowerCase()).not.toMatch(/\bvoice audio\b/);
  });

  it('leaves plain hello as text-only', () => {
    const inbound = telegramAdapter.parse(
      {
        message: {
          message_id: 44,
          text: 'hello',
          date: 1_700_000_000,
          from: { id: 9, first_name: 'Laud' },
          chat: { id: 9, type: 'private' },
        },
      },
      'worker-1',
      'ws-1',
    );

    expect(inbound?.content).toBe('hello');
    expect(inbound?.metadata?.preferAudio).toBeUndefined();
  });

  it('detects surface the audio as voice intent', () => {
    const inbound = telegramAdapter.parse(
      {
        message: {
          message_id: 45,
          text: 'surface the audio here in telegram',
          date: 1_700_000_000,
          from: { id: 9, first_name: 'Laud' },
          chat: { id: 9, type: 'private' },
        },
      },
      'worker-1',
      'ws-1',
    );

    expect(inbound?.metadata?.preferAudio).toBe('true');
  });

  it('accepts group messages for war-room replies', () => {
    const inbound = telegramAdapter.parse(
      {
        message: {
          message_id: 50,
          text: '@mySelormBot are you here?',
          date: 1_700_000_000,
          from: { id: 9, first_name: 'Laud' },
          chat: { id: -100123, type: 'supergroup' },
          entities: [{ type: 'mention', offset: 0, length: 12 }],
        },
      },
      'worker-1',
      'ws-1',
    );

    expect(inbound).not.toBeNull();
    expect(inbound?.contactId).toBe('-100123');
    expect(inbound?.metadata?.chatType).toBe('group');
  });

  it('drops bot-origin group messages', () => {
    const inbound = telegramAdapter.parse(
      {
        message: {
          message_id: 51,
          text: 'hello from another bot',
          date: 1_700_000_000,
          from: { id: 1, first_name: 'Other', is_bot: true },
          chat: { id: -100123, type: 'supergroup' },
        },
      },
      'worker-1',
      'ws-1',
    );
    expect(inbound).toBeNull();
  });
});

describe('isWorkerTelegramGroupDirected', () => {
  it('accepts @mention of this bot', async () => {
    const { isWorkerTelegramGroupDirected } = await import('./telegram-adapter.js');
    const ok = isWorkerTelegramGroupDirected(
      {
        message_id: 1,
        text: '@mySelormBot hi',
        date: 1,
        from: { id: 9 },
        chat: { id: -1, type: 'supergroup' },
        entities: [{ type: 'mention', offset: 0, length: 12 }],
      },
      'mySelormBot',
    );
    expect(ok).toBe(true);
  });

  it('rejects mention of a different bot when username known', async () => {
    const { isWorkerTelegramGroupDirected } = await import('./telegram-adapter.js');
    const ok = isWorkerTelegramGroupDirected(
      {
        message_id: 1,
        text: '@CarinaBot hi',
        date: 1,
        from: { id: 9 },
        chat: { id: -1, type: 'supergroup' },
        entities: [{ type: 'mention', offset: 0, length: 10 }],
      },
      'mySelormBot',
    );
    expect(ok).toBe(false);
  });
});

describe('startTelegramBusyStatus', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.unstubAllGlobals();
  });

  it('skips Working on it when stopped before delay', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ ok: true, result: { message_id: 99 } }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    const { startTelegramBusyStatus } = await import('./telegram-adapter.js');
    const stop = startTelegramBusyStatus('1:token', '7028923891');
    // First call is sendChatAction typing.
    expect(fetchMock).toHaveBeenCalled();
    stop();
    await vi.advanceTimersByTimeAsync(2000);
    const bodies = fetchMock.mock.calls.map((c) => String(c[1]?.body ?? ''));
    expect(bodies.some((b) => b.includes('Working on it'))).toBe(false);
  });

  it('sends Working on it after delay, then deletes on stop', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes('sendMessage')) {
        return { ok: true, json: async () => ({ ok: true, result: { message_id: 77 } }) };
      }
      return { ok: true, json: async () => ({ ok: true }) };
    });
    vi.stubGlobal('fetch', fetchMock);
    const { startTelegramBusyStatus } = await import('./telegram-adapter.js');
    const stop = startTelegramBusyStatus('1:token', '7028923891');
    await vi.advanceTimersByTimeAsync(1600);
    // Allow the async send to settle
    await Promise.resolve();
    await Promise.resolve();
    const sent = fetchMock.mock.calls.some(
      (c) => String(c[0]).includes('sendMessage') && String(c[1]?.body ?? '').includes('Working on it'),
    );
    expect(sent).toBe(true);
    stop();
    await Promise.resolve();
    await Promise.resolve();
    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes('deleteMessage'))).toBe(true);
    vi.useRealTimers();
  });
});
