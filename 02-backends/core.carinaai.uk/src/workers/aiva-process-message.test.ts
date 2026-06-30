import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendStreamMock = vi.fn();
let isolationEnabled = true;

vi.mock('../agents/worker-pool.js', () => ({
  getAivaWorkerPool: () => ({
    sendStream: sendStreamMock,
  }),
  isAivaWorkerIsolationEnabled: () => isolationEnabled,
}));

vi.mock('./worker-store.js', () => ({
  getWorker: vi.fn(async () => null),
}));

describe('processAivaMessageStream isolation routing', () => {
  beforeEach(() => {
    vi.resetModules();
    sendStreamMock.mockReset();
    isolationEnabled = true;
    process.env.AIVA_WORKER_ISOLATION = 'true';
  });

  it('routes through AivaWorkerPool when isolation is enabled', async () => {
    async function* mockStream() {
      yield { type: 'token' as const, content: 'hello' };
    }
    sendStreamMock.mockReturnValue(mockStream());

    const { processAivaMessageStream } = await import('./aiva-process-message.js');

    const params = {
      workerId: 'w-1',
      workspaceId: 'ws-1',
      userMessage: 'hi',
      channel: 'web' as const,
      contactId: 'c-1',
    };

    const parts: string[] = [];
    for await (const event of processAivaMessageStream(params)) {
      if (event.type === 'token') parts.push(event.content);
    }

    expect(parts).toEqual(['hello']);
    expect(sendStreamMock).toHaveBeenCalledWith(
      'w-1',
      { workerId: 'w-1', workspaceId: 'ws-1' },
      { type: 'process_message', params },
    );
  });

  it('uses direct path when isolation is disabled', async () => {
    isolationEnabled = false;
    process.env.AIVA_WORKER_ISOLATION = 'false';

    const { processAivaMessageStream } = await import('./aiva-process-message.js');
    const params = {
      workerId: 'w-1',
      workspaceId: 'ws-1',
      userMessage: 'hi',
      channel: 'web' as const,
      contactId: 'c-1',
    };

    const events: unknown[] = [];
    for await (const event of processAivaMessageStream(params)) {
      events.push(event);
    }

    expect(events).toEqual([]);
    expect(sendStreamMock).not.toHaveBeenCalled();
  });
});
