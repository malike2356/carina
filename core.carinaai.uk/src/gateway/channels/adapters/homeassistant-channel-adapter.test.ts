import { describe, expect, it } from 'vitest';
import { HomeAssistantChannelAdapter } from './homeassistant-channel-adapter.js';

describe('HomeAssistantChannelAdapter', () => {
  it('parses HA automation webhook payload', () => {
    const adapter = new HomeAssistantChannelAdapter(true, 'http://ha.local:8123', 'token');
    const msg = adapter.parseInbound({
      user_id: 'owner',
      conversation_id: 'assist',
      text: 'turn on lights',
    });
    expect(msg?.text).toBe('turn on lights');
    expect(msg?.channel).toBe('homeassistant');
    expect(msg?.conversationId).toBe('assist');
  });
});
