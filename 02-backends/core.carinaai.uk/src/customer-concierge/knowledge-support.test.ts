import { describe, expect, it } from 'vitest';
import {
  buildGroundedAnswer,
  detectSensitiveIntent,
  type PublishedKnowledgeHit,
} from './published-knowledge.js';
import {
  CUSTOMER_CONCIERGE_ALLOWED_TOOLS,
  isCustomerConciergeToolAllowed,
} from './tool-policy.js';

function hit(overrides: Partial<PublishedKnowledgeHit> = {}): PublishedKnowledgeHit {
  return {
    id: '00000000-0000-4000-8000-000000000010',
    title: 'Office hours',
    type: 'faq',
    excerpt: 'We are open Monday to Friday 9 to 5.',
    revision: 1,
    publishState: 'published',
    confidence: 0.8,
    ...overrides,
  };
}

describe('buildGroundedAnswer (702)', () => {
  it('returns grounded citations when confidence is high enough', () => {
    const result = buildGroundedAnswer({
      query: 'What are your office hours?',
      hits: [hit()],
      minConfidence: 0.45,
    });
    expect(result.grounded).toBe(true);
    expect(result.citations[0]?.title).toBe('Office hours');
    expect(result.excerpts.length).toBeGreaterThan(0);
    expect(result.fallbackReason).toBeUndefined();
  });

  it('falls back when there are no hits', () => {
    const result = buildGroundedAnswer({
      query: 'Unknown topic',
      hits: [],
    });
    expect(result.grounded).toBe(false);
    expect(result.fallbackReason).toBe('no_published_match');
  });

  it('falls back on low confidence', () => {
    const result = buildGroundedAnswer({
      query: 'office hours',
      hits: [hit({ confidence: 0.2 })],
      minConfidence: 0.45,
    });
    expect(result.grounded).toBe(false);
    expect(result.fallbackReason).toBe('low_confidence');
  });

  it('blocks sensitive intents without inventing an answer', () => {
    const result = buildGroundedAnswer({
      query: 'I need a refund and legal advice about a lawsuit',
      hits: [hit({ confidence: 0.95 })],
    });
    expect(result.grounded).toBe(false);
    expect(result.fallbackReason?.startsWith('sensitive_intent:')).toBe(true);
  });
});

describe('detectSensitiveIntent (702)', () => {
  it('detects refund and medical intents', () => {
    expect(detectSensitiveIntent('Can I get a refund?')).toBeTruthy();
    expect(detectSensitiveIntent('I need medical advice')).toBeTruthy();
    expect(detectSensitiveIntent('What time do you open?')).toBeNull();
  });
});

describe('concierge support tool allowlist (702)', () => {
  it('allows knowledge search, support case, and handoff tools', () => {
    expect(CUSTOMER_CONCIERGE_ALLOWED_TOOLS.has('concierge-knowledge-search')).toBe(true);
    expect(isCustomerConciergeToolAllowed('concierge-knowledge-search')).toBe(true);
    expect(isCustomerConciergeToolAllowed('concierge-support-case-create')).toBe(true);
    expect(isCustomerConciergeToolAllowed('support-case-create')).toBe(true);
    expect(isCustomerConciergeToolAllowed('concierge-handoff-request')).toBe(true);
    expect(isCustomerConciergeToolAllowed('handoff-request')).toBe(true);
  });

  it('still denies high-risk tools', () => {
    expect(isCustomerConciergeToolAllowed('shell-exec')).toBe(false);
    expect(isCustomerConciergeToolAllowed('memory')).toBe(false);
  });
});
