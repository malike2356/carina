import { describe, expect, it } from 'vitest';
import {
  lookupDirectoryPeer,
  registerDirectoryPeer,
  searchDirectory,
} from './directory.js';

describe('channel directory', () => {
  it('registers and looks up manual peers', async () => {
    registerDirectoryPeer({
      channel: 'matrix',
      peerId: '@alice:example.org',
      displayName: 'Alice',
      source: 'manual',
    });
    const hit = await lookupDirectoryPeer('matrix', '@alice:example.org');
    expect(hit?.displayName).toBe('Alice');
  });

  it('searches manual registry entries', async () => {
    registerDirectoryPeer({
      channel: 'slack',
      peerId: 'U123',
      displayName: 'Bob Ops',
      source: 'manual',
    });
    const hits = await searchDirectory('slack', 'bob');
    expect(hits.some((h) => h.peerId === 'U123')).toBe(true);
  });

  it('matches discord peers via manual registry', async () => {
    registerDirectoryPeer({
      channel: 'discord',
      peerId: '999',
      displayName: 'Manual Only',
      source: 'manual',
    });
    const manual = await lookupDirectoryPeer('discord', '999');
    expect(manual?.displayName).toBe('Manual Only');
  });
});
