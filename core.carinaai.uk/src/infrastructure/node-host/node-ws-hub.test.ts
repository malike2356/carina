import { describe, expect, it, afterEach, vi } from 'vitest';
import type { NodeCommand } from './types.js';
import {
  isNodeSocketConnected,
  pushNodeCommand,
  registerNodeSocket,
  resetNodeSocketHub,
  unregisterNodeSocket,
} from './node-ws-hub.js';

describe('node-ws-hub', () => {
  afterEach(() => {
    resetNodeSocketHub();
  });

  it('pushes commands to registered socket', () => {
    const sent: unknown[] = [];
    const sender = {
      send: (payload: unknown) => { sent.push(payload); },
      close: () => undefined,
    };
    registerNodeSocket('node-1', sender);
    expect(isNodeSocketConnected('node-1')).toBe(true);

    const cmd: NodeCommand = {
      id: 'cmd-1',
      nodeId: 'node-1',
      type: 'ping',
      payload: {},
      createdAt: new Date().toISOString(),
    };
    expect(pushNodeCommand('node-1', cmd)).toBe(true);
    expect(sent[0]).toEqual({ type: 'command', command: cmd });
    expect(pushNodeCommand('missing', cmd)).toBe(false);
  });

  it('replaces existing socket for same node', () => {
    const first = { send: vi.fn(), close: vi.fn() };
    const second = { send: vi.fn(), close: vi.fn() };
    registerNodeSocket('node-1', first);
    registerNodeSocket('node-1', second);
    expect(first.close).toHaveBeenCalled();
    unregisterNodeSocket('node-1', second);
    expect(isNodeSocketConnected('node-1')).toBe(false);
  });
});
