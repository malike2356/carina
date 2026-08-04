import { describe, expect, it } from 'vitest';
import {
  buildConnectChannelBody,
  formatSetupTime,
  getOnboardingChannels,
  getQuickConnectChannel,
  listQuickConnectCatalog,
  quickConnectByTier,
} from './channel-quick-connect.js';

describe('channel-quick-connect catalog', () => {
  it('sorts onboarding channels by friction tier', () => {
    const channels = getOnboardingChannels();
    expect(channels[0]?.id).toBe('web');
    expect(channels.every((channel) => !channel.advanced)).toBe(true);
    expect(channels.map((channel) => channel.tier)).toEqual([1, 2, 3, 3, 3]);
  });

  it('keeps advanced channels behind the advanced filter', () => {
    const quick = quickConnectByTier();
    const advanced = quickConnectByTier({ advanced: true }).filter((channel) => channel.advanced);
    expect(quick.some((channel) => channel.id === 'sms')).toBe(false);
    expect(advanced.map((channel) => channel.id)).toEqual(expect.arrayContaining(['sms', 'discord', 'teams']));
  });

  it('normalizes webchat alias to web', () => {
    expect(getQuickConnectChannel('webchat')?.channelType).toBe('web');
  });

  it('formats setup time labels', () => {
    expect(formatSetupTime(5)).toBe('5s');
    expect(formatSetupTime(60)).toBe('1 min');
    expect(formatSetupTime(120)).toBe('2 min');
  });

  it('serializes catalog groups for API responses', () => {
    const payload = listQuickConnectCatalog();
    expect(payload.count).toBeGreaterThan(0);
    expect(payload.quickConnect.length).toBeGreaterThan(0);
    expect(payload.quickConnect[0]).toMatchObject({
      setupTimeLabel: expect.any(String),
      webhookBaseUrl: expect.any(String),
    });
  });
});

describe('buildConnectChannelBody', () => {
  it('builds inline web chat connect payload', () => {
    const result = buildConnectChannelBody({
      workerId: 'worker-1',
      channelId: 'web',
    });
    expect(result).toEqual({
      path: '/api/channels',
      body: {
        workerId: 'worker-1',
        channel: 'web',
        identifier: 'web',
        credentials: {},
      },
    });
  });

  it('builds telegram token payload', () => {
    const result = buildConnectChannelBody({
      workerId: 'worker-1',
      channelId: 'telegram',
      config: { token: 'abc123' },
    });
    expect(result?.body).toMatchObject({
      workerId: 'worker-1',
      channel: 'telegram',
      credentials: { token: 'abc123' },
    });
  });

  it('returns null for unknown channels', () => {
    expect(buildConnectChannelBody({ workerId: 'w', channelId: 'unknown' })).toBeNull();
  });
});
