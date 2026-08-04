import { describe, expect, it } from 'vitest';
import {
  asCopyItems,
  googleJsOrigins,
  googleRedirectUris,
} from '@/lib/integration-guides/google-oauth';
import {
  getIntegrationGuide,
  guideIdForChannel,
  guideIdForGoogleTool,
} from '@/lib/integration-guides';

describe('integration guides google oauth', () => {
  it('includes app and admin redirect URIs plus calendar callback', () => {
    const uris = googleRedirectUris('https://app.carinaai.uk');
    expect(uris.tools).toContain('https://app.carinaai.uk/api/aiva/tools/oauth/google/callback');
    expect(uris.tools).toContain('https://admin.hireaiva.co.uk/api/aiva/tools/oauth/google/callback');
    expect(uris.gmail).toContain('https://app.carinaai.uk/api/aiva/email/oauth/gmail/callback');
    expect(uris.calendar).toContain('https://app.carinaai.uk/api/calendar/google/callback');
    expect(uris.youtube).toContain('https://app.carinaai.uk/api/aiva/youtube/oauth/callback');
    expect(uris.youtube).toContain('https://admin.hireaiva.co.uk/api/aiva/youtube/oauth/callback');
    expect(uris.all.length).toBeGreaterThanOrEqual(10);
  });

  it('builds copy items without duplicates collapsing', () => {
    const items = asCopyItems(
      ['https://app.carinaai.uk/a', 'https://app.carinaai.uk/a'],
      'URI',
    );
    expect(items).toHaveLength(2);
    expect(items[0]?.label).toBe('URI 1');
  });

  it('lists javascript origins for both product hosts', () => {
    const origins = googleJsOrigins('https://app.carinaai.uk');
    expect(origins).toContain('https://app.carinaai.uk');
    expect(origins).toContain('https://admin.hireaiva.co.uk');
  });
});

describe('integration guide registry', () => {
  it('builds google drive guide with platform-first steps and advanced URIs', () => {
    const guide = getIntegrationGuide('google-drive');
    expect(guide.title).toMatch(/Drive/i);
    expect(guide.steps.some((step) => /Skip Google Cloud setup/i.test(step.title))).toBe(true);
    expect(guide.steps.some((step) => /Connect with Google/i.test(step.title))).toBe(true);
    const copyStep = guide.steps.find((step) => (step.copyItems?.length ?? 0) > 0);
    expect(copyStep?.title).toMatch(/Advanced/i);
    expect(copyStep?.copyItems?.some((item) => item.value.includes('/api/aiva/tools/oauth/google/callback'))).toBe(true);
  });

  it('maps channels and tools to guide ids', () => {
    expect(guideIdForChannel('telegram')).toBe('telegram');
    expect(guideIdForChannel('email')).toBe('google-gmail');
    expect(guideIdForChannel('teams')).toBe('teams');
    expect(guideIdForChannel('instagram')).toBe('meta-social');
    expect(guideIdForGoogleTool('google-drive')).toBe('google-drive');
    expect(guideIdForGoogleTool('google-contacts')).toBe('google-tools');
  });

  it('maps vault product tools to guides', async () => {
    const { guideIdForTool, getIntegrationGuide } = await import('@/lib/integration-guides');
    expect(guideIdForTool('notion')).toBe('notion');
    expect(guideIdForTool('trello')).toBe('trello');
    expect(guideIdForTool('companies-house')).toBe('companies-house');
    expect(guideIdForTool('stripe')).toBe('stripe');
    expect(guideIdForTool('browser')).toBeNull();
    expect(getIntegrationGuide('notion').steps.length).toBeGreaterThanOrEqual(5);
    expect(getIntegrationGuide('companies-house').title).toMatch(/Companies House/i);
    expect(getIntegrationGuide('trello').steps.length).toBeGreaterThanOrEqual(5);
    expect(getIntegrationGuide('github').steps.length).toBeGreaterThanOrEqual(5);
    expect(getIntegrationGuide('whatsapp').steps.length).toBeGreaterThanOrEqual(5);
    expect(getIntegrationGuide('teams').steps.length).toBeGreaterThanOrEqual(6);
    expect(getIntegrationGuide('custom-http').title).toMatch(/HTTP/i);
  });

  it('keeps child-level detail in scanty former vault guides', () => {
    const notion = getIntegrationGuide('notion');
    expect(notion.steps.some((s) => /Share pages|Connect to/i.test(s.body))).toBe(true);
    const trello = getIntegrationGuide('trello');
    expect(trello.steps.some((s) => /BOTH|apiKey|API key/i.test(`${s.title} ${s.body}`))).toBe(true);
  });
});
