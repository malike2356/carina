import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  resetNodeSocketHub,
  sendProtocolCommand,
  registerNodeSocket,
  resolveProtocolResponse,
} from './node-ws-hub.js';
import { getNodeHostServer, resetNodeHostServerForTests } from './node-host-server.js';
import { NodeCapability } from './node-protocol.js';

afterEach(() => {
  resetNodeSocketHub();
  resetNodeHostServerForTests();
});

describe('NodeHostServer', () => {
  it('sendCommand resolves protocol responses', async () => {
    const sent: unknown[] = [];
    registerNodeSocket('node-1', {
      send: (payload) => { sent.push(payload); },
      close: () => undefined,
    });

    const promise = getNodeHostServer().sendCommand(
      'node-1',
      NodeCapability.CAMERA_CAPTURE,
      'capture',
      { source: 'back' },
      1000,
    );

    expect(sent).toHaveLength(1);
    const command = sent[0] as { id: string };
    resolveProtocolResponse({
      type: 'response',
      id: command.id,
      ok: true,
      payload: { dataUrl: 'data:image/jpeg;base64,abc' },
    });

    await expect(promise).resolves.toEqual({
      type: 'response',
      id: command.id,
      ok: true,
      payload: { dataUrl: 'data:image/jpeg;base64,abc' },
    });
  });

  it('sendProtocolCommand returns false when node is offline', () => {
    expect(sendProtocolCommand('missing', {
      type: 'command',
      id: '1',
      capability: NodeCapability.FILE_SYSTEM,
      method: 'shell',
      params: {},
    })).toBe(false);
  });
});
