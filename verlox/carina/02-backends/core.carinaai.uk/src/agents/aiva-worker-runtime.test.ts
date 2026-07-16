import { describe, expect, it } from 'vitest';
import { AivaWorkerRuntime } from './aiva-worker-runtime.js';

describe('AivaWorkerRuntime', () => {
  it('responds to ping with pong', async () => {
    const runtime = new AivaWorkerRuntime({ workerId: 'w-1', workspaceId: 'ws-1' });
    await expect(runtime.handle({ type: 'ping' })).resolves.toBe('pong');
  });
});
