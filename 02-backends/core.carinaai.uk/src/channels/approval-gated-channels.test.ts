import { describe, expect, it } from 'vitest';
import {
  isMessagingApprovalChannel,
  isOutboundApprovalChannel,
} from './approval-gated-channels.js';

describe('approval-gated-channels', () => {
  it('gates messaging channels for approval drafts', () => {
    expect(isMessagingApprovalChannel('whatsapp')).toBe(true);
    expect(isMessagingApprovalChannel('telegram')).toBe(true);
    expect(isMessagingApprovalChannel('web')).toBe(false);
    expect(isMessagingApprovalChannel('email')).toBe(false);
  });

  it('includes social and messaging, excludes web and email', () => {
    expect(isOutboundApprovalChannel('linkedin')).toBe(true);
    expect(isOutboundApprovalChannel('whatsapp')).toBe(true);
    expect(isOutboundApprovalChannel('web')).toBe(false);
    expect(isOutboundApprovalChannel('email')).toBe(false);
  });
});
