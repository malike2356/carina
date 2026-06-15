import { describe, expect, it } from 'vitest';
import { truncate, wrapText, drawBox } from './terminal.js';
import { renderViewLines } from './views.js';
import type { TuiSnapshot } from './data-provider.js';

describe('tui terminal', () => {
  it('truncates long strings', () => {
    expect(truncate('abcdef', 4)).toBe('abc…');
  });

  it('wraps text to width', () => {
    const lines = wrapText('one two three four', 10);
    expect(lines.length).toBeGreaterThan(1);
  });

  it('draws stable box height', () => {
    const box = drawBox('Title', ['a', 'b'], 20, 6, true);
    expect(box).toHaveLength(6);
  });
});

describe('tui views', () => {
  const snapshot: TuiSnapshot = {
    memoryReady: true,
    sessions: [{ sessionId: 's1', title: 'Deploy', lastAt: '2026-06-15' }],
    tasks: [{ kind: 'cron', id: 'j1', status: 'active', detail: '0 * * * * nightly' }],
    processes: [{ sessionId: 'p1', pid: 99, status: 'running', command: 'sleep 9', uptime: 3 }],
    tools: [{ name: 'shell-exec', dangerous: true }],
  };

  it('renders sessions with selection marker', () => {
    const lines = renderViewLines('sessions', snapshot, [], [], 0, 80);
    expect(lines.some((l) => l.startsWith('>'))).toBe(true);
  });

  it('renders process kill hint', () => {
    const lines = renderViewLines('processes', snapshot, [], [], 0, 80);
    expect(lines.some((l) => l.includes(':kill'))).toBe(true);
  });
});
