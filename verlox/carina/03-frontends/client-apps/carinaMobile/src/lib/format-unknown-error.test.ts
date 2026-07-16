import { describe, expect, it } from 'vitest';
import { formatUnknownError } from './format-unknown-error';

describe('formatUnknownError', () => {
  it('formats Error, string, and structured values', () => {
    expect(formatUnknownError(new Error('failed'))).toBe('failed');
    expect(formatUnknownError('plain failure')).toBe('plain failure');
    expect(formatUnknownError({ detail: 'structured failure' })).toBe('structured failure');
  });

  it('serializes objects without a known message field', () => {
    expect(formatUnknownError({ code: 42 })).toBe('{"code":42}');
    expect(formatUnknownError(null)).toBe('null');
  });
});
