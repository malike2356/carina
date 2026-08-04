import { describe, expect, it } from 'vitest';
import {
  buildLineage,
  describeLineageRelation,
  enrichEventWithLineage,
  isReplayAttempt,
  lineageFromEventMetadata,
} from '../session-lineage.js';

describe('SessionLineage', () => {
  it('builds root session lineage', () => {
    const lineage = buildLineage({ sessionId: 'sess-a' });
    expect(lineage.rootSessionId).toBe('sess-a');
    expect(lineage.parentSessionId).toBeNull();
    expect(describeLineageRelation(lineage)).toBe('new session');
  });

  it('builds child session lineage', () => {
    const lineage = buildLineage({
      sessionId: 'sess-child',
      parentSessionId: 'sess-parent',
      rootSessionId: 'sess-root',
      triggerType: 'retry',
      attemptNumber: 2,
    });
    expect(lineage.parentSessionId).toBe('sess-parent');
    expect(isReplayAttempt(lineage)).toBe(true);
    expect(describeLineageRelation(lineage)).toBe('retry of parent session');
  });

  it('enriches event payloads with lineage', () => {
    const lineage = buildLineage({
      sessionId: 'sess-e',
      parentSessionId: 'sess-p',
      triggerType: 'webhook',
    });
    const enriched = enrichEventWithLineage({ severity: 'info', source: 'test' }, lineage);
    expect(enriched.session_id).toBe('sess-e');
    expect(enriched.parent_session_id).toBe('sess-p');
    expect(enriched.metadata.trigger_type).toBe('webhook');
  });

  it('parses lineage from event metadata', () => {
    const lineage = lineageFromEventMetadata('sess-x', {
      parent_session_id: 'sess-y',
      root_session_id: 'sess-root',
      attempt_number: 3,
      trigger_type: 'taskflow',
    });
    expect(lineage.parentSessionId).toBe('sess-y');
    expect(lineage.attemptNumber).toBe(3);
  });
});
