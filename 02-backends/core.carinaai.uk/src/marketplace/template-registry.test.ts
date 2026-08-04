import { describe, expect, it } from 'vitest';
import { getMarketplaceTemplate, listMarketplaceTemplates } from './template-registry.js';
import { tierDisplayLabel } from '../billing/aiva-tier.js';
import { slotLimitForTier } from '../billing/aiva-tier.js';
import { ROLE_TEMPLATES } from '../workers/role-templates.js';

describe('template-registry', () => {
  it('lists the full role catalog', () => {
    const templates = listMarketplaceTemplates();
    expect(templates).toHaveLength(ROLE_TEMPLATES.length);
    expect(new Set(templates.map((row) => row.templateId)).size).toBe(templates.length);
    expect(templates.map((row) => row.templateId)).toContain('customer-support');
  });

  it('uses tierDisplayLabel without hard-coded price strings', () => {
    const template = getMarketplaceTemplate('property-manager');
    expect(template).toBeTruthy();
    expect(tierDisplayLabel(template!.tier)).toBe('Business');
    expect(slotLimitForTier(template!.tier)).toBeNull();
  });

  it('keeps legacy aliases working', () => {
    const template = getMarketplaceTemplate('support-agent');
    expect(template?.roleTemplateId).toBe('customer-support');
    expect(getMarketplaceTemplate('calendar-assistant')?.roleTemplateId).toBe('calendar-manager');
  });
});
