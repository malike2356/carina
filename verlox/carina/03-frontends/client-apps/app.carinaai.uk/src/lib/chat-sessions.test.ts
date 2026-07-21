import { describe, expect, it } from 'vitest';
import { isChatSessionUuid } from './chat-sessions';

describe('isChatSessionUuid', () => {
  it('accepts standard uuid v4 strings', () => {
    expect(isChatSessionUuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
  });

  it('rejects mobile-* client session ids', () => {
    expect(isChatSessionUuid('mobile-mrg55vq8-9u7ggyhw')).toBe(false);
    expect(isChatSessionUuid('')).toBe(false);
    expect(isChatSessionUuid(null)).toBe(false);
  });

  it('rejects arbitrary client labels that would fail uuid queries', () => {
    expect(isChatSessionUuid('smoke-session')).toBe(false);
    expect(isChatSessionUuid('default')).toBe(false);
  });
});
