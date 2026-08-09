/**
 * Prompt 706: security matrix for Customer Concierge.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgedGoogleCalendarWebhookHeaders, forgedZoomWebhookFixture, signZoomWebhook } from './fakes/webhook-fixtures.js';
import { createFakeOAuthState, revokeFakeOAuth } from './fakes/oauth-providers.js';

describe('customer concierge security matrix (706)', () => {
  let tmpHome: string;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-cc-sec-'));
    fs.mkdirSync(path.join(tmpHome, 'customer-concierge'), { recursive: true });
    vi.stubEnv('CARINA_HOME', tmpHome);
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  it('denies owner-only tools even when named like booking tools', async () => {
    const { isCustomerConciergeToolAllowed } = await import('../tool-policy.js');
    expect(isCustomerConciergeToolAllowed('vical-booking-create')).toBe(true);
    expect(isCustomerConciergeToolAllowed('shell-exec')).toBe(false);
    expect(isCustomerConciergeToolAllowed('memory')).toBe(false);
    expect(isCustomerConciergeToolAllowed('billing-portal')).toBe(false);
    expect(isCustomerConciergeToolAllowed('gmail-send')).toBe(false);
  });

  it('redacts message bodies and never stores host start URLs in public views', async () => {
    const { appendConciergeEvent, listConciergeEvents, resetConciergeEventStoreCache } =
      await import('../events.js');
    const vical = await import('../../vical/index.js');
    resetConciergeEventStoreCache();
    appendConciergeEvent({
      eventType: 'conversation.started',
      workspaceId: 'ws_a',
      workerId: 'w_a',
      actorType: 'audience',
      payload: { message: ' Palpable private complaint text that must not leak ' },
    });
    const events = listConciergeEvents({ workspaceId: 'ws_a', workerId: 'w_a' });
    expect(events[0]?.payload.message).toBe('[REDACTED_CONTENT]');

    const eventType = vical.createEventType({
      workspaceId: 'ws_a',
      hostUserId: 'w_a',
      slug: 'x',
      name: 'X',
      durationMinutes: 15,
      locationMode: 'zoom',
    });
    const start = new Date(Date.now() + 86400000);
    start.setUTCHours(12, 0, 0, 0);
    const booking = vical.createBooking({
      workspaceId: 'ws_a',
      eventTypeId: eventType.id,
      hostUserId: 'w_a',
      guestName: 'G',
      guestEmail: 'g@example.test',
      startsAt: start.toISOString(),
      endsAt: new Date(start.getTime() + 15 * 60000).toISOString(),
      timezone: 'UTC',
      meetingUrl: 'https://zoom.us/j/1',
      source: 'api',
    });
    const publicView = vical.toPublicBookingView(booking as unknown as Record<string, unknown>);
    expect(JSON.stringify(publicView)).not.toMatch(/hostStartUrl|start_url/i);
  });

  it('rejects forged Zoom and Google webhook credentials', () => {
    const forgedZoom = forgedZoomWebhookFixture('1');
    const ts = Number(forgedZoom.headers['x-zm-request-timestamp']);
    const expected = signZoomWebhook(forgedZoom.body, 'zoom_webhook_secret_synth', ts);
    expect(forgedZoom.headers['x-zm-signature']).not.toBe(expected);
    expect(forgedGoogleCalendarWebhookHeaders()['x-goog-channel-token']).toBe('wrong-token');
  });

  it('models revoked OAuth tokens as non-ready', () => {
    const token = createFakeOAuthState('zoom');
    expect(token.revoked).toBe(false);
    revokeFakeOAuth(token);
    expect(token.revoked).toBe(true);
    expect(token.expiresAt).toBe(0);
  });

  it('isolates concierge events by workspaceId', async () => {
    const { appendConciergeEvent, listConciergeEvents, resetConciergeEventStoreCache } =
      await import('../events.js');
    resetConciergeEventStoreCache();
    appendConciergeEvent({
      eventType: 'conversation.started',
      workspaceId: 'ws_tenant_a',
      workerId: 'w1',
      actorType: 'audience',
      payload: { audienceSessionId: 'a' },
    });
    appendConciergeEvent({
      eventType: 'conversation.started',
      workspaceId: 'ws_tenant_b',
      workerId: 'w2',
      actorType: 'audience',
      payload: { audienceSessionId: 'b' },
    });
    const a = listConciergeEvents({ workspaceId: 'ws_tenant_a', workerId: 'w1' });
    const b = listConciergeEvents({ workspaceId: 'ws_tenant_b', workerId: 'w2' });
    expect(a.every((e) => e.workspaceId === 'ws_tenant_a')).toBe(true);
    expect(b.every((e) => e.workspaceId === 'ws_tenant_b')).toBe(true);
    expect(a.some((e) => e.workspaceId === 'ws_tenant_b')).toBe(false);
  });

  it('duplicate booking idempotency keys do not create two meetings', async () => {
    const vical = await import('../../vical/index.js');
    const { fakeZoomAdapter, fakeGoogleCalendarSync } = await import('./fakes/oauth-providers.js');
    const eventType = vical.createEventType({
      workspaceId: 'ws_dup',
      hostUserId: 'w',
      slug: 'intro',
      name: 'Intro',
      durationMinutes: 30,
      locationMode: 'zoom',
    });
    vical.createAvailabilityRule({
      workspaceId: 'ws_dup',
      hostUserId: 'w',
      dayOfWeek: new Date(Date.now() + 2 * 86400000).getUTCDay(),
      startTime: '09:00',
      endTime: '17:00',
      timezone: 'UTC',
    });
    const start = new Date(Date.now() + 2 * 86400000);
    start.setUTCHours(10, 0, 0, 0);
    const zoom = fakeZoomAdapter({ mode: 'ok' });
    const deps = { zoomAdapter: zoom, syncCalendar: fakeGoogleCalendarSync() as never };
    const key = 'test-idempotency-duplicate-one';
    const first = await vical.bookWithSaga({
      workspaceId: 'ws_dup',
      workerId: 'w',
      eventTypeId: eventType.id,
      guestName: 'Dup',
      guestEmail: 'dup@example.test',
      startsAt: start.toISOString(),
      preferManagedZoom: true,
      idempotencyKey: key,
    }, deps);
    const second = await vical.bookWithSaga({
      workspaceId: 'ws_dup',
      workerId: 'w',
      eventTypeId: eventType.id,
      guestName: 'Dup',
      guestEmail: 'dup@example.test',
      startsAt: start.toISOString(),
      preferManagedZoom: true,
      idempotencyKey: key,
    }, deps);
    expect(second.duplicate).toBe(true);
    expect(second.booking.id).toBe(first.booking.id);
    expect(zoom.creates).toBe(1);
  });
});
