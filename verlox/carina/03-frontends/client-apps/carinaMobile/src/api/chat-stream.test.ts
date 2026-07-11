import { describe, expect, it } from 'vitest';
import { buildStreamUrl } from './chat-stream';

describe('buildStreamUrl', () => {
  it('includes sessionId and notify flags for hosted chat streams', () => {
    const url = new URL(
      buildStreamUrl('https://app.carinaai.uk/', 'hello world', 'mobile-abc123', true),
    );

    expect(url.pathname).toBe('/api/chat/stream');
    expect(url.searchParams.get('message')).toBe('hello world');
    expect(url.searchParams.get('sessionId')).toBe('mobile-abc123');
    expect(url.searchParams.get('notify')).toBe('1');
    expect(url.searchParams.get('prompt')).toBe('hello world');
  });

  it('omits optional params when not provided', () => {
    const url = new URL(buildStreamUrl('http://127.0.0.1:3000', 'ping'));

    expect(url.searchParams.get('sessionId')).toBeNull();
    expect(url.searchParams.get('notify')).toBeNull();
  });

  it('uses the same client session id for stream and clear payloads', () => {
    const clientSessionId = 'mobile-thread-42';
    const streamUrl = new URL(
      buildStreamUrl('https://app.carinaai.uk', 'hello', clientSessionId),
    );
    expect(streamUrl.searchParams.get('sessionId')).toBe(clientSessionId);
  });
});
