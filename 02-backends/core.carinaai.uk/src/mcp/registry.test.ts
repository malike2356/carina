import { describe, expect, it, afterEach } from 'vitest';
import { _resetMcpRegistryForTests, disconnectServer, listConnections } from './registry.js';

afterEach(() => {
  _resetMcpRegistryForTests();
});

describe('mcp registry', () => {
  it('starts with no connections', () => {
    expect(listConnections()).toEqual([]);
  });

  it('disconnect returns false for unknown server', async () => {
    const ok = await disconnectServer('nonexistent');
    expect(ok).toBe(false);
  });
});
