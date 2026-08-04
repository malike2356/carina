import { describe, expect, it } from 'vitest';
import {
  matchesSocialAutoReplyAllowlist,
  shouldAutoSendSocialReply,
} from './social-auto-reply.js';

describe('social-auto-reply', () => {
  it('matches allowlisted thanks messages', () => {
    expect(matchesSocialAutoReplyAllowlist('Thanks!', ['thanks', 'thank you'])).toBe(true);
    expect(matchesSocialAutoReplyAllowlist('Thank you so much', ['thank you'])).toBe(true);
    expect(matchesSocialAutoReplyAllowlist('Hello there', ['thanks'])).toBe(false);
  });

  it('auto-sends only when enabled and allowlisted', () => {
    expect(shouldAutoSendSocialReply({
      socialRequireApproval: true,
      socialAutoReplyEnabled: true,
      socialAutoReplyAllowlist: ['thanks'],
      draftText: 'Thanks!',
    })).toBe(true);

    expect(shouldAutoSendSocialReply({
      socialRequireApproval: true,
      socialAutoReplyEnabled: false,
      socialAutoReplyAllowlist: ['thanks'],
      draftText: 'Thanks!',
    })).toBe(false);

    expect(shouldAutoSendSocialReply({
      socialRequireApproval: false,
      socialAutoReplyEnabled: false,
      socialAutoReplyAllowlist: [],
      draftText: 'Custom reply',
    })).toBe(true);
  });
});
