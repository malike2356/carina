import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { WorkerChannelRow } from '../channels/types.js';
import type { Worker } from '../types/index.js';
import {
  isEmailLike,
  isPhoneLike,
  isTelegramBotToken,
  isTelegramChatId,
  normalizePhoneContact,
  parseChannelBindings,
  pickFirstOnboardingTarget,
  resolveOnboardingContact,
  resolveOutboundCredentials,
} from './provision-worker-channels.js';

function mockRow(channel: WorkerChannelRow['channel'], credentials: Record<string, string> = {}): WorkerChannelRow {
  return {
    id: `row-${channel}`,
    workerId: 'worker-1',
    workspaceId: 'ws-1',
    channel,
    identifier: channel === 'email' ? 'aiva@mail.carinaai.uk' : 'route-id',
    credentials: credentials.encrypted
      ? { encrypted: credentials.encrypted }
      : {},
    enabled: true,
    verified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...(Object.keys(credentials).length > 0 && !credentials.encrypted
      ? { _testCredentials: credentials }
      : {}),
  } as WorkerChannelRow & { _testCredentials?: Record<string, string> };
}

vi.mock('../channels/channel-store.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../channels/channel-store.js')>();
  return {
    ...actual,
    readChannelCredentials: (row: WorkerChannelRow & { _testCredentials?: Record<string, string> }) =>
      row._testCredentials ?? actual.readChannelCredentials(row),
  };
});

describe('provision-worker-channels helpers', () => {
  beforeEach(() => {
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;
  });

  it('parses channelBindings from hire payload', () => {
    expect(parseChannelBindings([
      { channel: 'email', identifier: 'owner@example.com' },
      { channel: 'web' },
    ])).toEqual([
      { channel: 'email', identifier: 'owner@example.com' },
      { channel: 'web', identifier: '' },
    ]);
  });

  it('detects binding value shapes', () => {
    expect(isTelegramBotToken('123456:ABC-DEF_token')).toBe(true);
    expect(isTelegramChatId('-100123456')).toBe(true);
    expect(isPhoneLike('+44 7700 900000')).toBe(true);
    expect(isEmailLike('support@company.com')).toBe(true);
    expect(normalizePhoneContact('+44 7700 900000')).toBe('447700900000');
  });

  it('resolves onboarding contacts per channel', () => {
    expect(resolveOnboardingContact('email', 'owner@example.com')).toBe('owner@example.com');
    expect(resolveOnboardingContact('whatsapp', '+44 7700 900000')).toBe('447700900000');
    expect(resolveOnboardingContact('telegram', '123456:token')).toBeNull();
    expect(resolveOnboardingContact('telegram', '99887766')).toBe('99887766');
  });

  it('picks the first channel with a bound contact and credentials', () => {
    const rows = [
      mockRow('web'),
      mockRow('email', { from_address: 'aiva@mail.carinaai.uk', worker_name: 'Aria' }),
      mockRow('whatsapp'),
    ];
    const target = pickFirstOnboardingTarget(rows, [
      { channel: 'email', identifier: 'owner@example.com' },
      { channel: 'whatsapp', identifier: '+44 7700 900000' },
    ]);
    expect(target?.row.channel).toBe('email');
    expect(target?.contactId).toBe('owner@example.com');
    expect(target?.credentials.from_address).toBe('aiva@mail.carinaai.uk');
  });

  it('uses env WhatsApp credentials when row has none', () => {
    process.env.WHATSAPP_ACCESS_TOKEN = 'token';
    process.env.WHATSAPP_PHONE_NUMBER_ID = '12345';
    const row = mockRow('whatsapp');
    expect(resolveOutboundCredentials('whatsapp', row)).toEqual({
      access_token: 'token',
      phone_number_id: '12345',
    });
  });

  it('skips onboarding when no bound contact exists', () => {
    const rows = [mockRow('email', { from_address: 'aiva@mail.carinaai.uk' })];
    expect(pickFirstOnboardingTarget(rows, [])).toBeNull();
  });
});
