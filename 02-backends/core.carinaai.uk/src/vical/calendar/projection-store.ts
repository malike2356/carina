/**
 * Persist calendar projections and delivery attempts (Prompt 704).
 */

import crypto from 'crypto';
import { loadVicalStore, mutateVicalStore } from '../store.js';
import type {
  VcalCalendarProjection,
  VcalCalendarWatchChannel,
  VcalDeliveryAttempt,
  VcalDeliveryState,
} from '../types.js';
import type { CalendarAdapterResult } from './types.js';

function nowIso(): string {
  return new Date().toISOString();
}

export function upsertCalendarProjection(input: {
  workspaceId: string;
  bookingId: string;
  result: CalendarAdapterResult;
  watch?: Partial<Pick<VcalCalendarProjection, 'watchChannelId' | 'watchResourceId' | 'watchExpiresAt'>>;
}): VcalCalendarProjection {
  const stamp = nowIso();
  const existing = loadVicalStore().calendarProjections.find(
    (p) => p.workspaceId === input.workspaceId && p.bookingId === input.bookingId,
  );
  const next: VcalCalendarProjection = {
    id: existing?.id ?? crypto.randomUUID(),
    workspaceId: input.workspaceId,
    bookingId: input.bookingId,
    provider: input.result.provider === 'none' ? 'none' : input.result.provider,
    providerEventId: input.result.providerEventId ?? existing?.providerEventId ?? null,
    etag: input.result.etag ?? existing?.etag ?? null,
    htmlLink: input.result.htmlLink ?? existing?.htmlLink ?? null,
    organizerEmail: input.result.organizerEmail ?? existing?.organizerEmail ?? null,
    attendees: input.result.attendees.length > 0 ? input.result.attendees : existing?.attendees ?? [],
    invitationSendRequested:
      input.result.invitationSendRequested || Boolean(existing?.invitationSendRequested),
    lastReconciledAt: stamp,
    syncError: input.result.ok ? null : input.result.errorMessage ?? 'calendar_error',
    watchChannelId: input.watch?.watchChannelId ?? existing?.watchChannelId ?? null,
    watchResourceId: input.watch?.watchResourceId ?? existing?.watchResourceId ?? null,
    watchExpiresAt: input.watch?.watchExpiresAt ?? existing?.watchExpiresAt ?? null,
    createdAt: existing?.createdAt ?? stamp,
    updatedAt: stamp,
  };
  mutateVicalStore((store) => {
    const idx = store.calendarProjections.findIndex((p) => p.id === next.id);
    if (idx >= 0) store.calendarProjections[idx] = next;
    else store.calendarProjections.push(next);
  });
  return next;
}

export function getCalendarProjection(
  workspaceId: string,
  bookingId: string,
): VcalCalendarProjection | null {
  return (
    loadVicalStore().calendarProjections.find(
      (p) => p.workspaceId === workspaceId && p.bookingId === bookingId,
    ) ?? null
  );
}

export function findProjectionByProviderEventId(
  providerEventId: string,
): VcalCalendarProjection | null {
  return (
    loadVicalStore().calendarProjections.find((p) => p.providerEventId === providerEventId) ?? null
  );
}

export function recordDeliveryAttempt(input: {
  workspaceId: string;
  bookingId: string;
  participantId?: string | null;
  channel: VcalDeliveryAttempt['channel'];
  state: VcalDeliveryState;
  providerMessageId?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
}): VcalDeliveryAttempt {
  const row: VcalDeliveryAttempt = {
    id: crypto.randomUUID(),
    workspaceId: input.workspaceId,
    bookingId: input.bookingId,
    participantId: input.participantId ?? null,
    channel: input.channel,
    state: input.state,
    providerMessageId: input.providerMessageId ?? null,
    errorCode: input.errorCode ?? null,
    errorMessage: input.errorMessage ?? null,
    attemptedAt: nowIso(),
  };
  mutateVicalStore((store) => {
    store.deliveryAttempts.push(row);
  });
  return row;
}

export function updateParticipantDelivery(input: {
  workspaceId: string;
  bookingId: string;
  email: string;
  deliveryState: VcalDeliveryState;
  responseStatus?: VcalCalendarProjection['attendees'][number]['responseStatus'];
}): void {
  const email = input.email.toLowerCase();
  mutateVicalStore((store) => {
    for (let i = 0; i < store.participants.length; i++) {
      const p = store.participants[i]!;
      if (p.workspaceId !== input.workspaceId || p.bookingId !== input.bookingId) continue;
      if (p.email.toLowerCase() !== email) continue;
      store.participants[i] = {
        ...p,
        deliveryState: input.deliveryState,
        responseStatus: input.responseStatus ?? p.responseStatus,
        updatedAt: nowIso(),
      };
    }
    const bIdx = store.bookings.findIndex(
      (b) => b.workspaceId === input.workspaceId && b.id === input.bookingId,
    );
    if (bIdx >= 0 && store.bookings[bIdx]!.guestEmail.toLowerCase() === email) {
      store.bookings[bIdx] = {
        ...store.bookings[bIdx]!,
        invitationDeliveryState: input.deliveryState,
        updatedAt: nowIso(),
      };
    }
  });
}

export function upsertWatchChannel(input: Omit<VcalCalendarWatchChannel, 'createdAt' | 'updatedAt'> & {
  createdAt?: string;
  updatedAt?: string;
}): VcalCalendarWatchChannel {
  const stamp = nowIso();
  const next: VcalCalendarWatchChannel = {
    ...input,
    createdAt: input.createdAt ?? stamp,
    updatedAt: stamp,
  };
  mutateVicalStore((store) => {
    const idx = store.calendarWatchChannels.findIndex(
      (c) => c.workspaceId === next.workspaceId && c.channelId === next.channelId,
    );
    if (idx >= 0) store.calendarWatchChannels[idx] = next;
    else store.calendarWatchChannels.push(next);
  });
  return next;
}

export function findWatchByChannelId(channelId: string): VcalCalendarWatchChannel | null {
  return loadVicalStore().calendarWatchChannels.find((c) => c.channelId === channelId) ?? null;
}

export function listExpiringWatchChannels(withinMs = 24 * 60 * 60_000): VcalCalendarWatchChannel[] {
  const cutoff = Date.now() + withinMs;
  return loadVicalStore().calendarWatchChannels.filter((c) => Date.parse(c.expiration) <= cutoff);
}
