import { describe, expect, it } from 'vitest';
import {
  buildConciergePersonaOverlay,
  formatBusinessHours,
  type ConciergeProfile,
} from './concierge-profile.js';

function sampleProfile(overrides: Partial<ConciergeProfile> = {}): ConciergeProfile {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    workerId: '00000000-0000-4000-8000-000000000002',
    workspaceId: '00000000-0000-4000-8000-000000000003',
    published: true,
    publishedAt: new Date().toISOString(),
    personaName: 'Support Desk',
    greetingMessage: 'Hi, how can I help?',
    businessName: 'Acme Property',
    businessDescription: 'We help landlords in Portsmouth.',
    knowledgeSourceIds: [],
    meetingTypeIds: [],
    channelConfig: { web: { enabled: true } },
    calendarProvider: 'google',
    calendarConnected: true,
    conferencingProvider: 'zoom',
    conferencingConnected: true,
    businessHours: {
      timezone: 'Europe/London',
      windows: [{ dayOfWeek: 1, start: '09:00', end: '17:00' }],
    },
    escalationEmail: 'owner@example.com',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('concierge persona overlay', () => {
  it('includes business identity and escalation rules', () => {
    const text = buildConciergePersonaOverlay(sampleProfile());
    expect(text).toContain('Support Desk');
    expect(text).toContain('Acme Property');
    expect(text).toContain('We help landlords in Portsmouth.');
    expect(text).toContain('owner@example.com');
    expect(text).toContain('Mon 09:00-17:00');
  });

  it('formats empty business hours', () => {
    expect(formatBusinessHours(null)).toBe('not configured');
  });
});
