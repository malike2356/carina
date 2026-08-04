import { describe, expect, it } from 'vitest';
import { hasPendingLocalMessages, mergeSessionMessages, memoryNeedsConflict, pickMemoryWinner, } from './merge.js';
describe('offline merge', () => {
    it('appends local messages after server messages without discarding', () => {
        const server = [
            { id: 'a', role: 'user', content: 'hi', timestamp: 1 },
            { id: 'b', role: 'assistant', content: 'hello', timestamp: 2 },
        ];
        const local = [
            ...server,
            { id: 'c', role: 'user', content: 'offline note', timestamp: 3 },
        ];
        const merged = mergeSessionMessages(local, server);
        expect(merged.map((m) => m.id)).toEqual(['a', 'b', 'c']);
    });
    it('detects pending local-only messages', () => {
        const server = [{ id: 'a', role: 'user', content: 'x', timestamp: 1 }];
        const local = [
            ...server,
            { id: 'b', role: 'user', content: 'y', timestamp: 2 },
        ];
        expect(hasPendingLocalMessages(local, server)).toBe(true);
        expect(hasPendingLocalMessages(server, server)).toBe(false);
    });
    it('flags memory conflicts when local edits diverge from server', () => {
        const base = {
            id: 'm1',
            title: 'Note',
            content: 'alpha',
            tags: [],
            updatedAt: '2026-06-01T10:00:00.000Z',
            syncedAt: '2026-06-01T09:00:00.000Z',
        };
        const server = { ...base, content: 'beta', updatedAt: '2026-06-01T11:00:00.000Z', syncedAt: null };
        expect(memoryNeedsConflict(base, server)).toBe(true);
        expect(pickMemoryWinner(base, server, 'local').content).toBe('alpha');
        expect(pickMemoryWinner(base, server, 'server').content).toBe('beta');
    });
});
