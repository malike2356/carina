import { describe, expect, it } from 'vitest';
import {
  RuntimeTimelineStore,
  normalizeRuntimeEvent,
  redactTimelineText,
  renderTimelineLines,
} from './timeline-store.js';

describe('runtime timeline store', () => {
  it('normalizes events with Carina-native labels', () => {
    const event = normalizeRuntimeEvent({ type: 'tool.started', detail: 'shell exec' });
    expect(event.label).toBe('Tool started');
    expect(event.severity).toBe('info');
  });

  it('keeps bounded memory and ordering', () => {
    const store = new RuntimeTimelineStore(2);
    store.add({ type: 'session.started', detail: 'one', at: '2026-07-13T10:00:00.000Z' });
    store.add({ type: 'model.started', detail: 'two', at: '2026-07-13T10:00:01.000Z' });
    store.add({ type: 'model.completed', detail: 'three', at: '2026-07-13T10:00:02.000Z' });
    expect(store.list().map((event) => event.detail)).toEqual(['two', 'three']);
  });

  it('filters by event type, severity, and session', () => {
    const store = new RuntimeTimelineStore();
    store.add({ type: 'runtime.error', sessionId: 'a' });
    store.add({ type: 'model.completed', sessionId: 'b' });
    expect(store.list({ severity: ['error'] })).toHaveLength(1);
    expect(store.list({ sessionId: 'b' })[0]?.type).toBe('model.completed');
  });

  it('redacts secrets before rendering', () => {
    const redacted = redactTimelineText('token=abc sk_test_123456789 user adad9243-955c-42d1-a876-4c806e554679');
    expect(redacted).toContain('token=[redacted]');
    expect(redacted).toContain('[secret]');
    expect(redacted).toContain('[id]');
  });

  it('renders narrow timeline lines safely', () => {
    const store = new RuntimeTimelineStore();
    store.add({
      type: 'runtime.warning',
      at: '2026-07-13T10:00:00.000Z',
      detail: 'A very long warning that should be truncated for a narrow terminal',
    });
    expect(renderTimelineLines(store.list(), 40)[0]?.length).toBeLessThanOrEqual(40);
  });
});
