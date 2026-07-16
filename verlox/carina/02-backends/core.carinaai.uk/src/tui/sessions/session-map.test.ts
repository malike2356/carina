import { describe, expect, it } from 'vitest';
import {
  buildSessionMap,
  currentSessionPath,
  cycleSession,
  forkSessionFallback,
  renderSessionMap,
  renameSessionLocal,
  searchSessionMap,
  type SessionMapNode,
} from './session-map.js';

const sessions = [
  { id: 'root', name: 'Root', model: 'deepseek', tokenCount: 10, messageCount: 2, updatedAt: '2026-07-13T10:00:00Z' },
  { id: 'child', name: 'Child branch', model: 'deepseek', tokenCount: 20, messageCount: 4, updatedAt: '2026-07-13T10:01:00Z' },
];

describe('session map', () => {
  it('marks the current session and searches fallback fields', () => {
    const map = buildSessionMap(sessions, 'child');
    expect(map.find((node) => node.id === 'child')?.status).toBe('active');
    expect(searchSessionMap(map, 'ranch')[0]?.id).toBe('child');
  });

  it('renders compact and wide maps', () => {
    const map = buildSessionMap(sessions, 'root');
    expect(renderSessionMap(map, 40).every((line) => line.length <= 40)).toBe(true);
    expect(renderSessionMap(map, 100)[0]).toContain('deepseek');
  });

  it('builds current session path when branch metadata exists', () => {
    const nodes: SessionMapNode[] = [
      { ...sessions[0]!, status: 'available' },
      { ...sessions[1]!, parentSessionId: 'root', status: 'active' },
    ];
    expect(currentSessionPath(nodes, 'child').map((node) => node.id)).toEqual(['root', 'child']);
  });

  it('cycles, forks, and renames locally', () => {
    const map = buildSessionMap(sessions, 'root');
    expect(cycleSession(map, 'root', 1)?.id).toBe('child');
    expect(forkSessionFallback(sessions[0]!, 'fork-1').parentSessionId).toBe('root');
    expect(renameSessionLocal(map[0]!, 'Renamed').name).toBe('Renamed');
  });
});
