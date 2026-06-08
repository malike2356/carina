import { describe, it, expect } from 'vitest';
import {
  FREE_TOOLS,
  PRO_TOOLS,
  canonicalToolName,
  resolveAllowlistForTier,
} from '../tool-tiers.js';

describe('tool tiers', () => {
  it('defines the documented FREE and PRO tool sets', () => {
    expect(FREE_TOOLS).toEqual([
      'chat',
      'search',
      'read_file',
      'get_property',
      'get_portfolio_summary',
    ]);
    expect(PRO_TOOLS).toContain('terminal');
    expect(PRO_TOOLS).toContain('write_file');
    expect(PRO_TOOLS).toContain('browser_navigate');
  });

  it('uses deny before allow and wildcard resolution', () => {
    expect(resolveAllowlistForTier('FREE', ['terminal'], ['terminal'])).toEqual({
      allowed: expect.arrayContaining(['terminal']),
      denied: ['terminal'],
      wildcards: [],
    });
    expect(resolveAllowlistForTier('ENTERPRISE').wildcards).toEqual(['*']);
  });

  it('canonicalizes legacy tool names', () => {
    expect(canonicalToolName('shell-exec')).toBe('terminal');
    expect(canonicalToolName('file-write')).toBe('write_file');
  });
});
