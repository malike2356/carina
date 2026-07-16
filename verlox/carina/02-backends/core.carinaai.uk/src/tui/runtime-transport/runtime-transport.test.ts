import { describe, expect, it, vi } from 'vitest';
import { createInProcessTransport } from './in-process-transport.js';
import { createJsonRpcTransport } from './json-rpc-transport.js';
import { createMockTransport } from './mock-transport.js';
import { resolveTransportMode, selectTuiRuntimeTransport } from './select.js';

describe('TUI runtime transport', () => {
  it('selects JSON-RPC by default and in-process only when requested', () => {
    expect(resolveTransportMode()).toBe('json-rpc');
    expect(resolveTransportMode('in-process')).toBe('in-process');
    expect(selectTuiRuntimeTransport({ mode: 'mock' }).mode).toBe('mock');
  });

  it('wraps existing runtime paths with one contract', () => {
    expect(createJsonRpcTransport('http://localhost:3333').mode).toBe('json-rpc');
    expect(createInProcessTransport().mode).toBe('in-process');
  });

  it('supports deterministic mock sessions, streams, and runtime events', async () => {
    const transport = createMockTransport();
    const listener = vi.fn();
    const unsubscribe = transport.subscribeRuntimeEvents(listener);
    const created = await transport.createSession();
    const chunks: string[] = [];

    await transport.streamChat(created.id, 'hello', {
      onToken: (token) => chunks.push(token),
      onDone: () => chunks.push('[done]'),
      onError: (error) => chunks.push(error.message),
    });

    expect(created.id).toBe('mock-2');
    expect(chunks).toEqual(['Mock reply: hello', '[done]']);
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ type: 'session' }));
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ type: 'stream' }));
    unsubscribe();
  });

  it('exposes runtime snapshots through the contract', async () => {
    const transport = createMockTransport();
    await expect(transport.getRuntimeSnapshot()).resolves.toMatchObject({
      mode: 'mock',
      healthy: true,
      activeSessionId: 'mock-session',
    });
  });
});
