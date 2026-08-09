/**
 * Prompt 703: booking saga + Zoom adapter hermetic tests.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConferenceAdapterResult, ConferencingAdapter } from '../conferencing/types.js';

describe('booking saga + Zoom (703)', () => {
  let tmpHome: string;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-vical-saga-'));
    vi.stubEnv('CARINA_HOME', tmpHome);
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  async function load() {
    return import('../index.js');
  }

  function fakeZoomAdapter(opts?: {
    failOnce?: boolean;
    mode?: 'ok' | 'expired' | 'rate' | 'revoke_fail';
  }): ConferencingAdapter & { creates: number; deletes: number; updates: number } {
    let failOnce = opts?.failOnce ?? false;
    const mode = opts?.mode ?? 'ok';
    const cache = new Map<string, ConferenceAdapterResult>();
    return {
      provider: 'zoom',
      creates: 0,
      deletes: 0,
      updates: 0,
      async createMeeting(input) {
        this.creates += 1;
        const existing = cache.get(input.idempotencyKey);
        if (existing) return { ...existing, duplicate: true, status: 'duplicate' };
        if (mode === 'expired') {
          return {
            ok: false,
            status: 'action_required',
            artifact: {
              provider: 'zoom',
              providerMeetingId: null,
              joinUrl: null,
              hostStartUrlPresent: false,
              passcodeRequired: false,
              waitingRoom: true,
              managed: true,
            },
            errorCode: 'expired_token',
            errorMessage: 'Zoom access token expired',
          };
        }
        if (failOnce) {
          failOnce = false;
          return {
            ok: false,
            status: 'retryable',
            artifact: {
              provider: 'zoom',
              providerMeetingId: null,
              joinUrl: null,
              hostStartUrlPresent: false,
              passcodeRequired: false,
              waitingRoom: true,
              managed: true,
            },
            errorCode: 'rate_limited',
            errorMessage: 'Zoom rate limited',
            retryAfterMs: 10,
          };
        }
        const result: ConferenceAdapterResult = {
          ok: true,
          status: 'succeeded',
          artifact: {
            provider: 'zoom',
            providerMeetingId: '999111',
            joinUrl: 'https://zoom.us/j/999111',
            hostStartUrlPresent: true,
            passcodeRequired: true,
            waitingRoom: true,
            managed: true,
          },
          hostStartUrl: 'https://zoom.us/s/999111?zak=SECRET_HOST_TOKEN',
        };
        cache.set(input.idempotencyKey, result);
        return result;
      },
      async updateMeeting(input) {
        this.updates += 1;
        return {
          ok: true,
          status: 'succeeded',
          artifact: {
            provider: 'zoom',
            providerMeetingId: input.providerMeetingId,
            joinUrl: 'https://zoom.us/j/999111',
            hostStartUrlPresent: true,
            passcodeRequired: true,
            waitingRoom: true,
            managed: true,
          },
          hostStartUrl: 'https://zoom.us/s/999111?zak=SECRET_HOST_TOKEN',
        };
      },
      async deleteMeeting(_input) {
        this.deletes += 1;
        if (mode === 'revoke_fail') {
          return {
            ok: false,
            status: 'action_required',
            artifact: {
              provider: 'zoom',
              providerMeetingId: _input.providerMeetingId,
              joinUrl: null,
              hostStartUrlPresent: false,
              passcodeRequired: false,
              waitingRoom: true,
              managed: true,
            },
            errorCode: 'api_error',
            errorMessage: 'delete failed',
          };
        }
        return {
          ok: true,
          status: 'succeeded',
          artifact: {
            provider: 'zoom',
            providerMeetingId: _input.providerMeetingId,
            joinUrl: null,
            hostStartUrlPresent: false,
            passcodeRequired: false,
            waitingRoom: true,
            managed: true,
          },
        };
      },
    };
  }

  async function seedZoomSlot(vical: Awaited<ReturnType<typeof load>>) {
    const workspaceId = `ws-${Math.random().toString(16).slice(2)}`;
    const workerId = 'worker-703';
    const { eventType } = vical.ensureDiscoveryDefaults({ workspaceId, hostUserId: workerId });
    vical.updateEventType(workspaceId, eventType.id, { locationMode: 'zoom' });
    const slots = vical.listOfferedSlots({
      workspaceId,
      eventTypeId: eventType.id,
      from: new Date('2026-08-05T10:00:00.000Z'),
      limit: 3,
    });
    expect(slots[0]).toBeTruthy();
    return { workspaceId, workerId, eventTypeId: eventType.id, startsAt: slots[0]!.start };
  }

  it('dedupes create into one booking and one Zoom meeting', async () => {
    const vical = await load();
    const seeded = await seedZoomSlot(vical);
    const zoom = fakeZoomAdapter();
    const key = 'idem-create-1';
    const deps = {
      zoomAdapter: zoom,
      syncCalendar: async ({ bookingId }: { bookingId: string }) => ({
        ok: true,
        booking: vical.getBooking(seeded.workspaceId, bookingId)!,
      }),
      sleep: async () => undefined,
    };

    const first = await vical.bookWithSaga(
      {
        workspaceId: seeded.workspaceId,
        workerId: seeded.workerId,
        eventTypeId: seeded.eventTypeId,
        guestName: 'Ada',
        guestEmail: 'ada@example.com',
        startsAt: seeded.startsAt,
        idempotencyKey: key,
      },
      deps,
    );
    const second = await vical.bookWithSaga(
      {
        workspaceId: seeded.workspaceId,
        workerId: seeded.workerId,
        eventTypeId: seeded.eventTypeId,
        guestName: 'Ada',
        guestEmail: 'ada@example.com',
        startsAt: seeded.startsAt,
        idempotencyKey: key,
      },
      deps,
    );

    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(first.booking.id).toBe(second.booking.id);
    expect(zoom.creates).toBe(1);
    expect(vical.getConferenceArtifact(seeded.workspaceId, first.booking.id)?.providerMeetingId).toBe(
      '999111',
    );
    expect(JSON.stringify(first.publicBooking)).not.toContain('SECRET_HOST_TOKEN');
  });

  it('retries rate limit then succeeds', async () => {
    const vical = await load();
    const seeded = await seedZoomSlot(vical);
    const zoom = fakeZoomAdapter({ failOnce: true });
    const result = await vical.bookWithSaga(
      {
        workspaceId: seeded.workspaceId,
        workerId: seeded.workerId,
        eventTypeId: seeded.eventTypeId,
        guestName: 'Bo',
        guestEmail: 'bo@example.com',
        startsAt: seeded.startsAt,
        idempotencyKey: 'idem-rate',
      },
      {
        zoomAdapter: zoom,
        syncCalendar: async ({ bookingId }) => ({
          ok: true,
          booking: vical.getBooking(seeded.workspaceId, bookingId)!,
        }),
        sleep: async () => undefined,
      },
    );
    expect(result.actionRequired).toBe(false);
    expect(result.booking.meetingUrl).toBe('https://zoom.us/j/999111');
    expect(zoom.creates).toBeGreaterThanOrEqual(2);
  });

  it('marks action_required on expired Zoom token', async () => {
    const vical = await load();
    const seeded = await seedZoomSlot(vical);
    const zoom = fakeZoomAdapter({ mode: 'expired' });
    const result = await vical.bookWithSaga(
      {
        workspaceId: seeded.workspaceId,
        workerId: seeded.workerId,
        eventTypeId: seeded.eventTypeId,
        guestName: 'Cy',
        guestEmail: 'cy@example.com',
        startsAt: seeded.startsAt,
        idempotencyKey: 'idem-exp',
      },
      {
        zoomAdapter: zoom,
        syncCalendar: async ({ bookingId }) => ({
          ok: true,
          booking: vical.getBooking(seeded.workspaceId, bookingId)!,
        }),
        sleep: async () => undefined,
      },
    );
    expect(result.actionRequired).toBe(true);
    expect(result.booking.orchestrationStatus).toBe('action_required');
    const ops = vical.listProviderOperationsForBooking(seeded.workspaceId, result.booking.id);
    expect(ops.some((op) => op.errorCode === 'expired_token' || op.status === 'action_required')).toBe(
      true,
    );
  });

  it('reschedules and cancels Zoom meetings', async () => {
    const vical = await load();
    const seeded = await seedZoomSlot(vical);
    const zoom = fakeZoomAdapter();
    const deps = {
      zoomAdapter: zoom,
      syncCalendar: async ({ bookingId }: { bookingId: string }) => ({
        ok: true,
        booking: vical.getBooking(seeded.workspaceId, bookingId)!,
      }),
      updateCalendar: async ({ bookingId }: { bookingId: string }) => ({
        ok: true,
        booking: vical.getBooking(seeded.workspaceId, bookingId)!,
      }),
      deleteCalendar: async ({ bookingId }: { bookingId: string }) => ({
        ok: true,
        booking: vical.getBooking(seeded.workspaceId, bookingId)!,
      }),
      sleep: async () => undefined,
    };
    const created = await vical.bookWithSaga(
      {
        workspaceId: seeded.workspaceId,
        workerId: seeded.workerId,
        eventTypeId: seeded.eventTypeId,
        guestName: 'Di',
        guestEmail: 'di@example.com',
        startsAt: seeded.startsAt,
        idempotencyKey: 'idem-rs',
      },
      deps,
    );
    const altSlots = vical.listOfferedSlots({
      workspaceId: seeded.workspaceId,
      eventTypeId: seeded.eventTypeId,
      from: new Date('2026-08-05T10:00:00.000Z'),
      limit: 5,
    });
    const nextSlot = altSlots.find((s) => s.start !== seeded.startsAt) ?? altSlots[1];
    expect(nextSlot).toBeTruthy();
    const rescheduled = await vical.rescheduleWithSaga(
      {
        workspaceId: seeded.workspaceId,
        workerId: seeded.workerId,
        bookingId: created.booking.id,
        startsAt: nextSlot!.start,
      },
      deps,
    );
    expect(rescheduled.booking.startsAt).toBe(nextSlot!.start);
    expect(zoom.updates).toBe(1);

    const cancelled = await vical.cancelWithSaga(
      {
        workspaceId: seeded.workspaceId,
        workerId: seeded.workerId,
        bookingId: created.booking.id,
        reason: 'guest_cancelled',
      },
      deps,
    );
    expect(cancelled.booking.status).toBe('cancelled');
    expect(zoom.deletes).toBe(1);
  });

  it('surfaces action_required when Zoom delete fails during cancel', async () => {
    const vical = await load();
    const seeded = await seedZoomSlot(vical);
    const zoomOk = fakeZoomAdapter();
    const created = await vical.bookWithSaga(
      {
        workspaceId: seeded.workspaceId,
        workerId: seeded.workerId,
        eventTypeId: seeded.eventTypeId,
        guestName: 'Ed',
        guestEmail: 'ed@example.com',
        startsAt: seeded.startsAt,
        idempotencyKey: 'idem-del',
      },
      {
        zoomAdapter: zoomOk,
        syncCalendar: async ({ bookingId }) => ({
          ok: true,
          booking: vical.getBooking(seeded.workspaceId, bookingId)!,
        }),
        sleep: async () => undefined,
      },
    );
    const zoomFail = fakeZoomAdapter({ mode: 'revoke_fail' });
    const cancelled = await vical.cancelWithSaga(
      {
        workspaceId: seeded.workspaceId,
        workerId: seeded.workerId,
        bookingId: created.booking.id,
      },
      {
        zoomAdapter: zoomFail,
        deleteCalendar: async ({ bookingId }) => ({
          ok: true,
          booking: vical.getBooking(seeded.workspaceId, bookingId)!,
        }),
      },
    );
    expect(cancelled.booking.status).toBe('cancelled');
    expect(cancelled.actionRequired).toBe(true);
  });

  it('validates Zoom webhook signatures and dedupes replay', async () => {
    const vical = await load();
    const crypto = await import('crypto');
    const secret = 'test-zoom-secret';
    const rawBody = JSON.stringify({
      event: 'meeting.updated',
      event_ts: 1,
      payload: { object: { id: '999111', join_url: 'https://zoom.us/j/999111', uuid: 'u1' } },
    });
    const timestamp = '1710000000';
    const signature = `v0=${crypto.createHmac('sha256', secret).update(`v0:${timestamp}:${rawBody}`).digest('hex')}`;
    expect(vical.verifyZoomWebhookSignature({ rawBody, timestamp, signature, secret })).toBe(true);
    expect(vical.verifyZoomWebhookSignature({ rawBody, timestamp, signature: 'v0=bad', secret })).toBe(
      false,
    );

    const first = vical.handleZoomWebhookEvent({
      event: 'meeting.updated',
      eventTs: 1,
      payload: { object: { id: '999111', join_url: 'https://zoom.us/j/999111', uuid: 'u1' } },
    });
    const second = vical.handleZoomWebhookEvent({
      event: 'meeting.updated',
      eventTs: 1,
      payload: { object: { id: '999111', join_url: 'https://zoom.us/j/999111', uuid: 'u1' } },
    });
    expect(first.duplicate).toBeFalsy();
    expect(second.duplicate).toBe(true);

    const crc = vical.buildZoomUrlValidationResponse('plain', secret);
    expect(crc.plainToken).toBe('plain');
    expect(crc.encryptedToken).toHaveLength(64);
  });

  it('redacts host start URLs from public views', async () => {
    const vical = await load();
    const view = vical.toPublicBookingView({
      id: 'b1',
      meetingUrl: 'https://zoom.us/j/1',
      start_url: 'https://zoom.us/s/1?zak=SECRET',
      metadata: { hostStartUrl: 'https://zoom.us/s/1?zak=SECRET', zoomMeetingId: '1' },
    });
    expect(JSON.stringify(view)).not.toContain('SECRET');
    expect(view.start_url).toBeUndefined();
  });

  it('Zoom adapter maps 401 and 429', async () => {
    const { ZoomConferencingAdapter } = await load();
    const adapter = new ZoomConferencingAdapter({
      getTokens: async () => ({ accessToken: 'tok' }),
      fetchImpl: async (_url, init) => {
        if (init?.method === 'POST') {
          return {
            status: 429,
            headers: { get: (n: string) => (n.toLowerCase() === 'retry-after' ? '2' : null) },
            json: async () => ({}),
            text: async () => 'rate',
          };
        }
        return {
          status: 401,
          headers: { get: () => null },
          json: async () => ({}),
          text: async () => 'unauth',
        };
      },
    });
    const rate = await adapter.createMeeting({
      workspaceId: 'w',
      workerId: 'x',
      bookingId: 'b',
      topic: 't',
      startsAt: '2026-08-17T10:00:00.000Z',
      durationMinutes: 30,
      idempotencyKey: 'k-rate',
    });
    expect(rate.status).toBe('retryable');
    expect(rate.retryAfterMs).toBe(2000);

    const expired = await adapter.deleteMeeting({
      workspaceId: 'w',
      workerId: 'x',
      bookingId: 'b',
      providerMeetingId: '1',
      idempotencyKey: 'k-del',
    });
    expect(expired.errorCode).toBe('expired_token');
  });
});
