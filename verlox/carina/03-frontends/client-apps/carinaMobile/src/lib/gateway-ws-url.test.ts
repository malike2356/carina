import { describe, expect, it } from 'vitest';
import { gatewayWebSocketUrl } from '@/lib/gateway-ws-url';

describe('gatewayWebSocketUrl', () => {
  it('converts https gateway URLs to companion websocket paths', () => {
    expect(gatewayWebSocketUrl('https://app.carinaai.uk/')).toBe(
      'wss://app.carinaai.uk/api/companion/ws',
    );
  });

  it('converts http gateway URLs to ws companion paths', () => {
    expect(gatewayWebSocketUrl('http://192.168.1.20:3333')).toBe(
      'ws://192.168.1.20:3333/api/companion/ws',
    );
  });
});
