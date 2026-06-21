import { describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { handleAcpRequest, type AcpConnection } from './acp-server.js';
import type { AcpResponse } from './acp-types.js';

function mockConnection(): { conn: AcpConnection; messages: Array<AcpResponse> } {
  const messages: Array<AcpResponse> = [];
  const conn: AcpConnection = {
    ws: {
      readyState: WebSocket.OPEN,
      send: (raw: string) => {
        messages.push(JSON.parse(raw) as AcpResponse);
      },
    },
    sessions: new Map(),
  };
  return { conn, messages };
}

describe('handleAcpRequest', () => {
  it('returns -32601 for unknown methods', async () => {
    const { conn, messages } = mockConnection();
    await handleAcpRequest(conn, {
      jsonrpc: '2.0',
      id: 42,
      method: 'session.unknown',
    });

    expect(messages).toHaveLength(1);
    expect(messages[0]?.error?.code).toBe(-32601);
    expect(messages[0]?.error?.message).toContain('Method not found');
  });

  it('initialize returns Carina name and capabilities', async () => {
    const { conn, messages } = mockConnection();
    await handleAcpRequest(conn, {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
    });

    expect(messages[0]?.result).toMatchObject({
      name: 'Carina',
      capabilities: {
        streaming: true,
        multiSession: true,
        tools: true,
        fileContext: true,
        cancelation: true,
      },
    });
  });

  it('session.create returns a sessionId', async () => {
    const { conn, messages } = mockConnection();
    await handleAcpRequest(conn, {
      jsonrpc: '2.0',
      id: 2,
      method: 'session.create',
      params: { workingDirectory: '/tmp/project' },
    });

    const result = messages[0]?.result as { sessionId?: string } | undefined;
    expect(result?.sessionId).toBeTruthy();
    expect(conn.sessions.has(String(result?.sessionId))).toBe(true);
  });
});
