import { describe, expect, it } from 'vitest';
import { CommandQueue } from './command-queue.js';
import type { CarinaMessage } from '../types/index.js';

function msg(content: string, sessionId = 'sess-1'): CarinaMessage {
  return {
    id: 'm1',
    sessionId,
    content,
    source: 'web',
    timestamp: new Date(),
  };
}

describe('CommandQueue', () => {
  it('enqueue places entries in session lane', () => {
    const queue = new CommandQueue({ cap: 5 });
    const entry = queue.enqueue('sess-1', 'web', msg('hello'));
    expect(entry?.sessionId).toBe('sess-1');
    expect(queue.status().totalEntries).toBe(1);
  });

  it('interrupt entries dequeue first', async () => {
    const queue = new CommandQueue({ maxConcurrent: 2 });
    queue.enqueue('sess-a', 'web', msg('first', 'sess-a'));
    queue.enqueue('sess-b', 'web', msg('interrupt', 'sess-b'), 'interrupt');
    const next = await queue.dequeue();
    expect(next?.mode).toBe('interrupt');
  });

  it('drops new entry when drop policy is new', () => {
    const queue = new CommandQueue({ cap: 1, drop: 'new' });
    queue.enqueue('sess-1', 'web', msg('one'));
    const dropped = queue.enqueue('sess-1', 'web', msg('two'));
    expect(dropped).toBeNull();
  });

  it('drain removes lane entries', () => {
    const queue = new CommandQueue();
    queue.enqueue('sess-1', 'web', msg('hello'));
    queue.drain('sess-1');
    expect(queue.status().totalEntries).toBe(0);
  });

  it('collect coalesces within debounce window', () => {
    const queue = new CommandQueue({ debounceMs: 1000, defaultMode: 'collect' });
    queue.setSessionConfig('sess-1', { defaultMode: 'collect' });
    const first = queue.enqueue('sess-1', 'web', msg('a'));
    const second = queue.enqueue('sess-1', 'web', msg('b'));
    expect(first?.id).toBe(second?.id);
    expect(queue.status().totalEntries).toBe(1);
  });
});
