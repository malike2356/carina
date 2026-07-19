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
});
