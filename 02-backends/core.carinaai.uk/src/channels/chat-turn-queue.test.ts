import { afterEach, describe, expect, it } from 'vitest';
import {
  clearInboundTurnQueueForTests,
  inboundTurnKey,
  pendingInboundTurnCount,
  runInboundTurnSerialized,
} from './chat-turn-queue.js';

describe('chat turn queue', () => {
  afterEach(() => clearInboundTurnQueueForTests());

  it('runs turns for one worker and conversation in arrival order', async () => {
    const key = inboundTurnKey({ workerId: 'worker-a', channel: 'telegram', conversationId: 'chat-1' });
    const events: string[] = [];
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const first = runInboundTurnSerialized(key, async () => {
      events.push('first-start');
      await firstGate;
      events.push('first-end');
      return 'one';
    });
    const second = runInboundTurnSerialized(key, async () => {
      events.push('second');
      return 'two';
    });

    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(events).toEqual(['first-start']);
    expect(pendingInboundTurnCount()).toBe(1);
    releaseFirst();
    await expect(first).resolves.toBe('one');
    await expect(second).resolves.toBe('two');
    expect(events).toEqual(['first-start', 'first-end', 'second']);
    expect(pendingInboundTurnCount()).toBe(0);
  });

  it('does not serialize different workers or conversations', async () => {
    const a = inboundTurnKey({ workerId: 'worker-a', channel: 'telegram', conversationId: 'chat-1' });
    const b = inboundTurnKey({ workerId: 'worker-b', channel: 'telegram', conversationId: 'chat-1' });
    const events: string[] = [];
    await Promise.all([
      runInboundTurnSerialized(a, async () => events.push('a')),
      runInboundTurnSerialized(b, async () => events.push('b')),
    ]);
    expect(new Set(events)).toEqual(new Set(['a', 'b']));
  });

  it('continues after a failed turn', async () => {
    const key = 'worker-a:telegram:chat-1';
    await expect(runInboundTurnSerialized(key, async () => {
      throw new Error('failed turn');
    })).rejects.toThrow('failed turn');
    await expect(runInboundTurnSerialized(key, async () => 'recovered')).resolves.toBe('recovered');
  });
});
