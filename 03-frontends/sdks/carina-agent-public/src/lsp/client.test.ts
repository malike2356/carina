import { describe, expect, it } from 'vitest';
import { defaultLspSessionKey } from './client.js';

describe('lsp client', () => {
  it('builds stable session keys', () => {
    expect(defaultLspSessionKey('sess-1')).toBe('lsp:sess-1');
    expect(defaultLspSessionKey('sess-1')).toBe(defaultLspSessionKey('sess-1'));
  });

  it('generates key when session empty', () => {
    const key = defaultLspSessionKey('');
    expect(key.startsWith('lsp:')).toBe(true);
  });
});
