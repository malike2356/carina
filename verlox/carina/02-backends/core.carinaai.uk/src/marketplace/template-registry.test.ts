import { describe, expect, it } from 'vitest';
import { getMarketplaceTemplate, listMarketplaceTemplates } from './template-registry.js';
import { tierDisplayLabel } from '../billing/aiva-tier.js';
import { slotLimitForTier } from '../billing/aiva-tier.js';

describe('template-registry', () => {
  it('lists five marketplace templates', () => {
    const templates = listMarketplaceTemplates();
    expect(templates).toHaveLength(5);
    expect(templates.map((row) => row.templateId).sort()).toEqual([
      'calendar-assistant',
      'finance-admin',
      'outreach-specialist',
      'property-manager',
      'support-agent',
    ]);
  });

  it('uses tierDisplayLabel without hard-coded price strings', () => {
    const template = getMarketplaceTemplate('property-manager');
    expect(template).toBeTruthy();
    expect(tierDisplayLabel(template!.tier)).toBe('Business');
    expect(slotLimitForTier(template!.tier)).toBeNull();
  });

  it('maps support-agent to customer-support role template', () => {
    const template = getMarketplaceTemplate('support-agent');
    expect(template?.roleTemplateId).toBe('customer-support');
  });
});
