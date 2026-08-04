import { describe, expect, it } from 'vitest';
import { useLocalChat } from './useLocalChat';

describe('useLocalChat', () => {
  it('exports a hook factory', () => {
    expect(typeof useLocalChat).toBe('function');
  });
});
