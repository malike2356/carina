import { describe, it, expect } from 'vitest';
import { normalizeDomain } from '../domain.js';

describe('normalizeDomain', () => {
  it('accepts valid domains', () => {
    expect(normalizeDomain('example.com')).toBe('example.com');
    expect(normalizeDomain('https://Example.COM/path')).toBe('example.com');
  });

  it('rejects localhost and private targets', () => {
    expect(normalizeDomain('localhost')).toBeNull();
    expect(normalizeDomain('127.0.0.1')).toBeNull();
    expect(normalizeDomain('10.0.0.1')).toBeNull();
  });

  it('rejects invalid labels', () => {
    expect(normalizeDomain('not a domain')).toBeNull();
    expect(normalizeDomain('')).toBeNull();
  });
});
