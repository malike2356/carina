import { describe, expect, it } from 'vitest';
import { chunkTokens } from './expo-push.js';

describe('expo-push', () => {
  it('chunks tokens for Expo batch limit', () => {
    const tokens = Array.from({ length: 250 }, (_, i) => `ExponentPushToken[${i}]`);
    const chunks = chunkTokens(tokens);
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(100);
    expect(chunks[2]).toHaveLength(50);
  });
});
