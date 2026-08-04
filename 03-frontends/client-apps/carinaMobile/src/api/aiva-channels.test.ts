import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AivaApiError } from './aiva-client';
import {
  buildConnectChannelPayload,
  catalogChannelsForConnect,
  connectedChannels,
  disconnectAivaChannel,
  parseAivaChannelsList,
  validateConnectChannelValues,
} from './aiva-channels';

describe('parseAivaChannelsList', () => {
  it('parses channel cards with connection flags', () => {
    const parsed = parseAivaChannelsList({
      channels: [
        {
          id: 'email',
          type: 'email',
          label: 'Email',
          identifier: 'front-desk@inbound.example',
          active: true,
          connected: true,
          verified: true,
          connectionStatus: 'connected',
        },
        {
          id: 'telegram',
          type: 'telegram',
          label: 'Telegram',
          active: false,
          connected: false,
          verified: false,
          connectionStatus: 'disconnected',
        },
      ],
      planTier: 'starter',
      channelLimit: 3,
      connectedCount: 1,
    });
    expect(parsed.connectedCount).toBe(1);
    expect(parsed.channels[0]).toMatchObject({
      type: 'email',
      identifier: 'front-desk@inbound.example',
      connected: true,
    });
    expect(connectedChannels(parsed.channels)).toHaveLength(1);
    expect(catalogChannelsForConnect(parsed.channels).map((c) => c.type)).toEqual([
      'telegram',
    ]);
  });
});

describe('connect payload builders', () => {
  it('builds telegram credentials payload', () => {
    expect(
      buildConnectChannelPayload('w1', 'telegram', { bot_token: ' 123:ABC ' }),
    ).toEqual({
      workerId: 'w1',
      channel: 'telegram',
      credentials: { bot_token: '123:ABC' },
    });
  });

  it('builds email inbound payload with optional from_address', () => {
    expect(
      buildConnectChannelPayload('w1', 'email', { from_address: 'desk@example.com' }),
    ).toEqual({
      workerId: 'w1',
      channel: 'email',
      credentials: { from_address: 'desk@example.com' },
    });
    expect(validateConnectChannelValues('email', {})).toBeNull();
  });

  it('requires messaging channel fields', () => {
    expect(validateConnectChannelValues('telegram', {})).toMatch(/Bot token/i);
    expect(validateConnectChannelValues('telegram', { bot_token: 'x' })).toBeNull();
  });
});

describe('disconnectAivaChannel', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('throws a readable error when disconnect fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'Channel not found' }), {
        status: 404,
        statusText: 'Not Found',
      }),
    );

    try {
      await disconnectAivaChannel('https://app.carinaai.uk', 'w1', 'telegram', {
        apiKey: 't',
      });
      throw new Error('expected disconnect to reject');
    } catch (err) {
      expect(err).toBeInstanceOf(AivaApiError);
      expect((err as AivaApiError).message).toMatch(/Channel not found|404/);
    }
  });

  it('returns ok on successful disconnect', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(
      disconnectAivaChannel('https://app.carinaai.uk', 'w1', 'email-row', { apiKey: 't' }),
    ).resolves.toEqual({ ok: true });
  });
});
