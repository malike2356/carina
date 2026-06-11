import { describe, expect, it } from 'vitest';
import {
  ChatTurnRegistry,
  isActiveTurn,
  isThinkingPlaceholder,
  shouldPersistCompletedTurn,
  shouldUpdateDomForTurn,
  thinkingIndicatorHtml,
} from './web-chat-turn.js';

describe('web-chat-turn helpers', () => {
  it('accepts stream events only for the active turn', () => {
    const active = { sessionId: 'sess-a', turnId: 'turn-1' };
    expect(isActiveTurn(active, 'sess-a', 'turn-1')).toBe(true);
    expect(isActiveTurn(active, 'sess-a', 'turn-2')).toBe(false);
    expect(isActiveTurn(active, 'sess-b', 'turn-1')).toBe(false);
  });

  it('renders an accessible thinking indicator', () => {
    const html = thinkingIndicatorHtml();
    expect(html).toContain('thinking-indicator');
    expect(html).toContain('aria-label="Carina is thinking"');
    expect(html.match(/thinking-dot/g)?.length).toBe(3);
  });

  it('detects placeholder content before the first stream chunk', () => {
    expect(isThinkingPlaceholder(null)).toBe(true);
    expect(isThinkingPlaceholder('...')).toBe(true);
    expect(isThinkingPlaceholder('Hello')).toBe(false);
  });
});

describe('ChatTurnRegistry', () => {
  it('binds chunks and completion to the turn that started the stream', () => {
    const registry = new ChatTurnRegistry();
    registry.beginTurn('sess-a', 'turn-1');
    registry.recordChunk('turn-1', 'Hel');
    registry.recordChunk('turn-1', 'lo');

    const completed = registry.completeTurn('turn-1');
    expect(completed?.fullText).toBe('Hello');
    expect(completed?.sessionId).toBe('sess-a');
    expect(shouldPersistCompletedTurn(completed!)).toBe(true);
    expect(shouldUpdateDomForTurn({ sessionId: 'sess-a', turnId: 'turn-1' }, completed!)).toBe(true);
  });

  it('abandons the active stream when switching chats and persists on completion', () => {
    const registry = new ChatTurnRegistry();
    registry.beginTurn('sess-a', 'turn-1');
    registry.recordChunk('turn-1', 'Part');

    registry.abandonTurn('turn-1');
    expect(registry.shouldUpdateDom('turn-1')).toBe(false);
    expect(registry.shouldAcceptStreamEvent('sess-a', 'turn-1')).toBe(true);

    registry.recordChunk('turn-1', 'ial');
    const completed = registry.completeTurn('turn-1');
    expect(completed?.fullText).toBe('Partial');
    expect(completed?.disposition).toBe('abandoned');
    expect(shouldPersistCompletedTurn(completed!)).toBe(true);
    expect(shouldUpdateDomForTurn(registry.getActiveTurn(), completed!)).toBe(false);
  });

  it('supersedes the prior turn when a second message is sent before the first reply finishes', () => {
    const registry = new ChatTurnRegistry();
    registry.beginTurn('sess-a', 'turn-1');
    registry.recordChunk('turn-1', 'Stale');

    registry.beginTurn('sess-a', 'turn-2');
    expect(registry.getTurn('turn-1')?.disposition).toBe('superseded');
    expect(registry.shouldAcceptStreamEvent('sess-a', 'turn-1')).toBe(false);
    expect(registry.recordChunk('turn-1', ' reply')).toBeNull();

    const staleDone = registry.completeTurn('turn-1');
    expect(staleDone?.fullText).toBe('Stale');
    expect(shouldPersistCompletedTurn(staleDone!)).toBe(false);

    registry.recordChunk('turn-2', 'Fresh');
    const freshDone = registry.completeTurn('turn-2');
    expect(freshDone?.fullText).toBe('Fresh');
    expect(shouldPersistCompletedTurn(freshDone!)).toBe(true);
  });

  it('returns to a prior thread with the reply that completed in the background', () => {
    const registry = new ChatTurnRegistry();
    const store = new Map<string, Array<{ role: string; content: string }>>();

    function persist(sessionId: string, content: string) {
      const msgs = store.get(sessionId) ?? [];
      msgs.push({ role: 'carina', content });
      store.set(sessionId, msgs);
    }

    registry.beginTurn('sess-a', 'turn-1');
    registry.recordChunk('turn-1', 'Saved in thread A');
    registry.abandonTurn('turn-1');

    registry.beginTurn('sess-b', 'turn-2');
    registry.recordChunk('turn-2', 'Live in thread B');
    const completedB = registry.completeTurn('turn-2');
    if (completedB && shouldPersistCompletedTurn(completedB)) {
      persist(completedB.sessionId, completedB.fullText);
    }

    registry.recordChunk('turn-1', ' after switch');
    const completedA = registry.completeTurn('turn-1');
    if (completedA && shouldPersistCompletedTurn(completedA)) {
      persist(completedA.sessionId, completedA.fullText);
    }

    expect(store.get('sess-a')?.[0]?.content).toBe('Saved in thread A after switch');
    expect(store.get('sess-b')?.[0]?.content).toBe('Live in thread B');
  });

  it('ignores late chunks from older turns after supersede or cancel', () => {
    const registry = new ChatTurnRegistry();
    registry.beginTurn('sess-a', 'turn-1');
    registry.cancelTurn('turn-1');
    expect(registry.recordChunk('turn-1', 'late')).toBeNull();
    expect(registry.shouldAcceptStreamEvent('sess-a', 'turn-1')).toBe(false);
  });
});
