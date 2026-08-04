import { describe, expect, it } from 'vitest';
import { AUTO_RESPONSE_TEMPLATES, containsLeakedInformation, getAutoResponse } from './auto-responder.js';

describe('auto-responder', () => {
  it('never auto-responds to spam', () => {
    expect(getAutoResponse('spam')).toBeNull();
  });

  it('replies to hot leads without impersonating a human', () => {
    const response = getAutoResponse('hot_lead');
    expect(response?.toLowerCase()).toContain('a member of the team');
    expect(response?.toLowerCase()).not.toContain(' i ');
  });

  it('replies to warm leads with a generic pointer, no direct answer', () => {
    const response = getAutoResponse('warm_lead');
    expect(response).toBe(AUTO_RESPONSE_TEMPLATES.warm_lead);
  });

  it('replies to cold leads with generic engagement only', () => {
    const response = getAutoResponse('cold_lead');
    expect(response).toBe(AUTO_RESPONSE_TEMPLATES.cold_lead);
  });

  it('never leaks an email, phone number, or price in any template', () => {
    for (const template of Object.values(AUTO_RESPONSE_TEMPLATES)) {
      expect(containsLeakedInformation(template)).toBe(false);
    }
  });

  it('flags a template that would leak pricing', () => {
    expect(containsLeakedInformation('This costs £250 per month')).toBe(true);
  });

  it('flags a template that would leak an email address', () => {
    expect(containsLeakedInformation('Email us at team@example.com')).toBe(true);
  });
});
