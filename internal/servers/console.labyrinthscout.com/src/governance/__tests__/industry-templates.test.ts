import { describe, it, expect } from 'vitest';
import {
  getIndustryTemplate,
  listIndustryTemplates,
  requiresHumanReview,
  resolveEventMapping,
} from '../industry-templates.js';

describe('industry-templates', () => {
  it('listIndustryTemplates returns 4 templates', () => {
    expect(listIndustryTemplates()).toHaveLength(4);
  });

  it('getIndustryTemplate returns correct template for uk-property', () => {
    const template = getIndustryTemplate('uk-property');
    expect(template.id).toBe('uk-property');
    expect(template.sector).toBe('Property');
    expect(template.base_pack).toBe('regulated');
  });

  it('uk-property: policy_violation maps to AML flag and requires_human_review=true', () => {
    const mapping = resolveEventMapping('uk-property', 'policy_violation');
    expect(mapping).not.toBeNull();
    expect(mapping?.regulatory_category).toBe('Potential AML flag');
    expect(mapping?.requires_human_review).toBe(true);
  });

  it('legal-uk: email_send maps to SRA confidentiality and requires_human_review=true', () => {
    const mapping = resolveEventMapping('legal-uk', 'email_send');
    expect(mapping).not.toBeNull();
    expect(mapping?.regulation).toContain('SRA');
    expect(mapping?.requires_human_review).toBe(true);
  });

  it('finance-uk: anomaly maps to Market Abuse Regulation', () => {
    const mapping = resolveEventMapping('finance-uk', 'anomaly');
    expect(mapping).not.toBeNull();
    expect(mapping?.regulation).toContain('Market Abuse Regulation');
  });

  it('requiresHumanReview: true for email-send in legal-uk', () => {
    expect(requiresHumanReview('legal-uk', 'email-send')).toBe(true);
  });

  it('requiresHumanReview: false for tool not in human_review_required_for list', () => {
    expect(requiresHumanReview('legal-uk', 'web-search')).toBe(false);
  });

  it('resolveEventMapping: returns null for unmapped event type', () => {
    expect(resolveEventMapping('uk-property', 'unknown_event_xyz')).toBeNull();
  });

  it('finance-uk base_pack is restrict (more restrictive than property/legal)', () => {
    expect(getIndustryTemplate('finance-uk').base_pack).toBe('restrict');
    expect(getIndustryTemplate('uk-property').base_pack).toBe('regulated');
    expect(getIndustryTemplate('legal-uk').base_pack).toBe('regulated');
  });

  it('healthcare-uk retention is 2920 days (8 years)', () => {
    expect(getIndustryTemplate('healthcare-uk').logging_retention_days).toBe(2920);
  });
});
