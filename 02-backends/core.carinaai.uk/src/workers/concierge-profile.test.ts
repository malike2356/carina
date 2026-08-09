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
    tone: 'warm and clear',
    supportedLanguages: ['en'],
    responseBoundaries: 'Do not invent legal or medical advice.',
    contactCapturePolicy: { requireEmailBeforeBooking: true },
    bookingPermission: 'offer_and_book',
    slaPolicy: { firstResponseHours: 4, resolutionHours: 48 },
    answerPolicy: { minConfidence: 0.45 },
    escalationRules: { handoffOnSensitiveIntent: true },
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
    expect(text).toContain('Grounded answer rules');
    expect(text).toContain('concierge-knowledge-search');
  });

  it('formats empty business hours', () => {
    expect(formatBusinessHours(null)).toBe('not configured');
  });
});
