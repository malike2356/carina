import { describe, expect, it } from 'vitest';
import { isLikelyNetworkError } from './offline-queue';

describe('offline-queue', () => {
  it('detects common network failures', () => {
    expect(isLikelyNetworkError('Network request failed')).toBe(true);
    expect(isLikelyNetworkError('Failed to fetch')).toBe(true);
    expect(isLikelyNetworkError('Carina API 500: boom')).toBe(false);
  });
});
