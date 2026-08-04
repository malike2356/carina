import { describe, expect, it } from 'vitest';
import { formatUnknownError } from './format-unknown-error';

describe('formatUnknownError', () => {
  it('reads Error.message', () => {
    expect(formatUnknownError(new Error('boom'))).toBe('boom');
  });

  it('reads message field on plain objects', () => {
    expect(formatUnknownError({ message: 'quota exceeded' })).toBe('quota exceeded');
  });

  it('json-stringifies opaque objects instead of [object Object]', () => {
    expect(formatUnknownError({ code: 42 })).toBe('{"code":42}');
  });
});
