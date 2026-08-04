import { describe, expect, it } from 'vitest';
import { analyseRoleDescriptionHeuristic } from './role-analyser-heuristic.js';
import { formatDomainLabel } from './role-analyser-types.js';

describe('role-analyser-heuristic', () => {
  it('detects customer support roles', () => {
    const result = analyseRoleDescriptionHeuristic(
      'I need someone to handle customer support emails, answer FAQs, and escalate complex issues.',
    );
    expect(result.domain).toBe('customer_support');
    expect(result.roleTemplateId).toBe('customer-support');
    expect(result.requiredTools).toContain('email-read');
    expect(result.recommendedTier).toBe('starter');
    expect(result.confidenceScore).toBeGreaterThan(0.7);
  });

  it('maps finance admin to business tier', () => {
    const result = analyseRoleDescriptionHeuristic(
      'Track invoices, expenses, and receipts in spreadsheets. Flag anomalies for review.',
    );
    expect(result.domain).toBe('finance_admin');
    expect(result.recommendedTier).toBe('business');
  });

  it('maps property management simple roles to growth minimum', () => {
    const result = analyseRoleDescriptionHeuristic('Handle tenant WhatsApp messages about maintenance.');
    expect(result.domain).toBe('property_management');
    expect(result.recommendedTier).toBe('growth');
  });

  it('formats domain labels for UI', () => {
    expect(formatDomainLabel('customer_support')).toBe('Customer Support');
  });
});
