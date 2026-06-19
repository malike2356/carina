import { describe, expect, it } from 'vitest';
import {
  buildSessionAnchorContext,
  formatSessionAnchor,
  parseSessionAnchor,
} from './session-anchors.js';

describe('session-anchors', () => {
  it('formats markdown session anchors', () => {
    expect(formatSessionAnchor('Deploy chat', 'abc-123')).toBe('[Deploy chat](#abc-123)');
  });

  it('parses session id from anchor href', () => {
    expect(parseSessionAnchor('#abc-123')).toBe('abc-123');
    expect(parseSessionAnchor('abc-123')).toBeNull();
  });

  it('adds web surface anchor guidance', () => {
    const ctx = buildSessionAnchorContext('web');
    expect(ctx).toContain('[Short title](#session-id)');
  });
});
