import { describe, expect, it } from 'vitest';
import { lookupHostname, suggestMagicDnsHostname } from './dns-helpers.js';

describe('dns-helpers', () => {
  it('suggests magicdns hostnames', () => {
    expect(suggestMagicDnsHostname('My Agent', 'tailnet.ts.net')).toBe('my-agent.tailnet.ts.net');
  });

  it('resolves localhost', async () => {
    const result = await lookupHostname('localhost');
    expect(result.addresses.length).toBeGreaterThan(0);
  });
});
