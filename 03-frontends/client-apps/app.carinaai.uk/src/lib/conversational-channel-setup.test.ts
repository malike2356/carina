import { describe, expect, it } from 'vitest';
import { detectConversationalChannelSetup } from './conversational-channel-setup';

describe('detectConversationalChannelSetup', () => {
  it.each([
    ['Connect my Telegram bot', 'telegram'],
    ['I want to use Slack', 'slack'],
    ['Set up Twilio for text messages', 'sms'],
    ['Enable a chat widget on my website', 'web'],
    ['Configure Microsoft Teams', 'teams'],
  ])('detects %s', (message, channel) => {
    expect(detectConversationalChannelSetup(message)?.channel).toBe(channel);
  });

  it('does not treat removal as setup', () => {
    expect(detectConversationalChannelSetup('Disconnect Telegram')).toBeNull();
  });

  it('does not interpret a credential by itself as setup intent', () => {
    expect(detectConversationalChannelSetup('123456789:ABC-secret-token')).toBeNull();
  });

  it('marks credential fields as sensitive', () => {
    const setup = detectConversationalChannelSetup('Connect Telegram');
    expect(setup?.fields[0]).toMatchObject({ key: 'bot_token', sensitive: true });
  });
});
