import { beforeEach, describe, expect, it } from 'vitest';
import { collectPresence, emitSystemEvent, listSystemEvents } from './system-events.js';

describe('system-events', () => {
  beforeEach(() => {
    emitSystemEvent({ type: 'test.reset', message: 'reset marker' });
  });

  it('emits and lists system events', () => {
    emitSystemEvent({ type: 'gateway.start', message: 'gateway started' });
    const events = listSystemEvents(5);
    expect(events.some((e) => e.type === 'gateway.start')).toBe(true);
  });

  it('returns presence entries array', () => {
    const presence = collectPresence();
    expect(Array.isArray(presence)).toBe(true);
  });
});
