import { describe, expect, it } from 'vitest';
import {
  buildSearchEscalationHint,
  extractSearchEscalationPreference,
  SEARCH_ESCALATION_POLICY,
} from './search-escalation.js';

describe('search escalation', () => {
  it('documents internal-first policy', () => {
    expect(SEARCH_ESCALATION_POLICY).toContain('internal sources');
    expect(SEARCH_ESCALATION_POLICY).toContain('open web');
  });

  it('hints on lookup follow-ups', () => {
    const hint = buildSearchEscalationHint('does he have an email address?');
    expect(hint).toContain('internal sources first');
    expect(buildSearchEscalationHint('hello')).toBeNull();
  });

  it('extracts next-time proactive search preferences', () => {
    const pref = extractSearchEscalationPreference(
      'next time when i ask you to find something and you do not find it on one source, '
      + 'do not stop there - be proactive and search by any means necessary, starting from internal',
    );
    expect(pref).toContain('internal workspace sources');
    expect(pref).toContain('open web');
  });
});
