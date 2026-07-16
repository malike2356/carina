import { describe, expect, it } from 'vitest';

function settled<T>(result: PromiseSettledResult<T>, key?: string): T | null {
  if (result.status === 'fulfilled') {
    const v = result.value;
    if (key && v && typeof v === 'object') {
      return ((v as Record<string, unknown>)[key] ?? v) as T;
    }
    return v;
  }
  return null;
}

describe('mutation settled helper', () => {
  it('returns fulfilled value', () => {
    expect(settled({ status: 'fulfilled', value: { count: 3 } })).toEqual({ count: 3 });
  });

  it('extracts nested key when provided', () => {
    expect(settled({ status: 'fulfilled', value: { proposals: [1, 2] } }, 'proposals')).toEqual([1, 2]);
  });

  it('returns null for rejected promises', () => {
    expect(settled({ status: 'rejected', reason: new Error('fail') })).toBeNull();
  });
});
