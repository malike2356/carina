import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildLinkedSessionExternalKey,
  claimLinkCode,
  clearSessionIdentityForTests,
  ensureSessionIdentity,
  formatLinkedIdentitiesBlock,
  generateLinkCode,
  getCrossChannelSharing,
  getSessionIdentityState,
  setCrossChannelSharing,
} from './session-identity-prefs.js';

vi.mock('./identity-resolver.js', () => ({
  identityLinksEnabled: () => true,
  getIdentityResolver: () => ({
    getIdentities: vi.fn().mockResolvedValue([]),
  }),
}));

afterEach(() => {
  clearSessionIdentityForTests();
});

describe('session-identity-prefs', () => {
  it('generates and claims link codes case-insensitively', () => {
    const code = generateLinkCode({
      userId: 'usr_test',
      channel: 'telegram',
      channelUserId: 'tg-1',
    });
    const claimed = claimLinkCode(code.toUpperCase(), {
      channel: 'discord',
      channelUserId: 'dc-1',
    });
    expect(claimed).toEqual({ userId: 'usr_test' });
  });

  it('uses canonical session key when cross-channel sharing is on', async () => {
    setCrossChannelSharing('usr_a', true);
    const key = await buildLinkedSessionExternalKey('usr_a', 'telegram', 'telegram:123');
    expect(key).toBe('canonical:usr_a');
  });

  it('keeps per-channel key when sharing is off', async () => {
    setCrossChannelSharing('usr_b', false);
    const key = await buildLinkedSessionExternalKey('usr_b', 'telegram', 'telegram:456');
    expect(key).toBe('telegram:456');
  });

  it('tracks reply channel unless docked', () => {
    ensureSessionIdentity('sess-1', 'usr_c', {
      channel: 'telegram',
      conversationId: 'chat-1',
    });
    ensureSessionIdentity('sess-1', 'usr_c', {
      channel: 'web',
      conversationId: 'web-1',
    });
    let state = getSessionIdentityState('sess-1');
    expect(state?.replyChannel).toBe('web');

    state!.dockedFrom = 'telegram';
    state!.replyChannel = 'discord';
    ensureSessionIdentity('sess-1', 'usr_c', {
      channel: 'web',
      conversationId: 'web-2',
    });
    state = getSessionIdentityState('sess-1');
    expect(state?.replyChannel).toBe('discord');
  });

  it('formats linked identities block', () => {
    const block = formatLinkedIdentitiesBlock(
      [
        { channel: 'telegram', displayName: '@alice', channelUserId: '1' },
        { channel: 'web', displayName: null, channelUserId: 'browser' },
      ],
      'telegram',
      { originChannel: 'web', dockedFrom: 'web' },
    );
    expect(block).toContain('Linked Identities');
    expect(block).toContain('telegram');
    expect(block).toContain('/dock back');
  });

  it('defaults cross-channel sharing to on', () => {
    expect(getCrossChannelSharing('usr_new')).toBe(true);
  });
});
