/**
 * Durable saga ledger records inside the viCal file store (Prompt 703).
 */

import crypto from 'crypto';
import { loadVicalStore, mutateVicalStore } from '../store.js';
import type {
  VcalAvailabilityHold,
  VcalBookingIntent,
  VcalBookingParticipant,
  VcalConferenceArtifact,
  VcalProviderOperation,
  VcalProviderOpStatus,
  VcalWebhookReceipt,
} from '../types.js';

function nowIso(d = new Date()): string {
  return d.toISOString();
}

const DEFAULT_HOLD_TTL_MS = 15 * 60_000;

export function createAvailabilityHold(input: {
  workspaceId: string;
  hostUserId: string;
  eventTypeId: string;
  startsAt: string;
  endsAt: string;
  ttlMs?: number;
  bookingIntentId?: string;
}): VcalAvailabilityHold {
  const stamp = nowIso();
  const hold: VcalAvailabilityHold = {
    id: crypto.randomUUID(),
    workspaceId: input.workspaceId,
    hostUserId: input.hostUserId,
    eventTypeId: input.eventTypeId,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    holderToken: crypto.randomBytes(16).toString('hex'),
    expiresAt: new Date(Date.now() + (input.ttlMs ?? DEFAULT_HOLD_TTL_MS)).toISOString(),
    bookingIntentId: input.bookingIntentId,
    createdAt: stamp,
  };
  mutateVicalStore((store) => {
    store.availabilityHolds = store.availabilityHolds.filter(
      (h) => Date.parse(h.expiresAt) > Date.now(),
    );
    store.availabilityHolds.push(hold);
  });
  return hold;
}

export function releaseAvailabilityHold(holdId: string): void {
  mutateVicalStore((store) => {
    store.availabilityHolds = store.availabilityHolds.filter((h) => h.id !== holdId);
  });
}

export function findBookingByIdempotencyKey(
  workspaceId: string,
  idempotencyKey: string,
): { bookingId: string } | null {
  const booking = loadVicalStore().bookings.find(
    (b) => b.workspaceId === workspaceId && b.idempotencyKey === idempotencyKey,
  );
  return booking ? { bookingId: booking.id } : null;
}

export function findIntentByIdempotencyKey(
  workspaceId: string,
  idempotencyKey: string,
): VcalBookingIntent | null {
  return (
    loadVicalStore().bookingIntents.find(
      (i) => i.workspaceId === workspaceId && i.idempotencyKey === idempotencyKey,
    ) ?? null
  );
}

export function upsertBookingIntent(input: {
  workspaceId: string;
  workerId?: string;
  eventTypeId: string;
  idempotencyKey: string;
  guestName: string;
  guestEmail: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  holdId?: string;
  metadata?: Record<string, unknown>;
}): VcalBookingIntent {
  const existing = findIntentByIdempotencyKey(input.workspaceId, input.idempotencyKey);
  if (existing) return existing;
  const stamp = nowIso();
  const intent: VcalBookingIntent = {
    id: crypto.randomUUID(),
    workspaceId: input.workspaceId,
    workerId: input.workerId,
    eventTypeId: input.eventTypeId,
    idempotencyKey: input.idempotencyKey,
    guestName: input.guestName,
    guestEmail: input.guestEmail.toLowerCase(),
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    timezone: input.timezone,
    status: 'open',
    holdId: input.holdId,
    metadata: input.metadata ?? {},
    createdAt: stamp,
    updatedAt: stamp,
  };
  mutateVicalStore((store) => {
    store.bookingIntents.push(intent);
  });
  return intent;
}

export function commitBookingIntent(intentId: string, bookingId: string): void {
  mutateVicalStore((store) => {
    const idx = store.bookingIntents.findIndex((i) => i.id === intentId);
    if (idx < 0) return;
    store.bookingIntents[idx] = {
      ...store.bookingIntents[idx]!,
      status: 'committed',
      bookingId,
      updatedAt: nowIso(),
    };
  });
}

export function addBookingParticipants(input: {
  workspaceId: string;
  bookingId: string;
  hostEmail?: string;
  guestEmail: string;
  guestName?: string;
}): VcalBookingParticipant[] {
  const stamp = nowIso();
  const rows: VcalBookingParticipant[] = [
    {
      id: crypto.randomUUID(),
      workspaceId: input.workspaceId,
      bookingId: input.bookingId,
      role: 'guest',
      email: input.guestEmail.toLowerCase(),
      name: input.guestName,
      deliveryState: 'pending',
      createdAt: stamp,
    },
  ];
  if (input.hostEmail) {
    rows.unshift({
      id: crypto.randomUUID(),
      workspaceId: input.workspaceId,
      bookingId: input.bookingId,
      role: 'host',
      email: input.hostEmail.toLowerCase(),
      deliveryState: 'pending',
      createdAt: stamp,
    });
  }
  mutateVicalStore((store) => {
    store.participants.push(...rows);
  });
  return rows;
}

export function upsertConferenceArtifact(
  artifact: Omit<VcalConferenceArtifact, 'createdAt' | 'updatedAt'> & {
    createdAt?: string;
    updatedAt?: string;
  },
): VcalConferenceArtifact {
  const stamp = nowIso();
  const next: VcalConferenceArtifact = {
    ...artifact,
    createdAt: artifact.createdAt ?? stamp,
    updatedAt: stamp,
  };
  mutateVicalStore((store) => {
    const idx = store.conferenceArtifacts.findIndex(
      (a) => a.bookingId === next.bookingId && a.workspaceId === next.workspaceId,
    );
    if (idx >= 0) store.conferenceArtifacts[idx] = { ...store.conferenceArtifacts[idx]!, ...next, updatedAt: stamp };
    else store.conferenceArtifacts.push(next);
  });
  return next;
}

export function getConferenceArtifact(
  workspaceId: string,
  bookingId: string,
): VcalConferenceArtifact | null {
  return (
    loadVicalStore().conferenceArtifacts.find(
      (a) => a.workspaceId === workspaceId && a.bookingId === bookingId,
    ) ?? null
  );
}

export function recordProviderOperation(input: {
  workspaceId: string;
  bookingId: string;
  provider: string;
  action: string;
  idempotencyKey: string;
  status: VcalProviderOpStatus;
  attempt?: number;
  providerResourceId?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
}): VcalProviderOperation {
  const existing = loadVicalStore().providerOperations.find(
    (op) =>
      op.workspaceId === input.workspaceId
      && op.idempotencyKey === input.idempotencyKey
      && op.action === input.action,
  );
  if (existing && (existing.status === 'succeeded' || existing.status === 'duplicate')) {
    return existing;
  }
  const stamp = nowIso();
  if (existing) {
    const next: VcalProviderOperation = {
      ...existing,
      status: input.status,
      attempt: input.attempt ?? existing.attempt + 1,
      providerResourceId: input.providerResourceId ?? existing.providerResourceId,
      errorCode: input.errorCode ?? null,
      errorMessage: input.errorMessage ?? null,
      updatedAt: stamp,
    };
    mutateVicalStore((store) => {
      const idx = store.providerOperations.findIndex((op) => op.id === existing.id);
      if (idx >= 0) store.providerOperations[idx] = next;
    });
    return next;
  }
  const row: VcalProviderOperation = {
    id: crypto.randomUUID(),
    workspaceId: input.workspaceId,
    bookingId: input.bookingId,
    provider: input.provider,
    action: input.action,
    idempotencyKey: input.idempotencyKey,
    status: input.status,
    attempt: input.attempt ?? 1,
    providerResourceId: input.providerResourceId ?? null,
    errorCode: input.errorCode ?? null,
    errorMessage: input.errorMessage ?? null,
    createdAt: stamp,
    updatedAt: stamp,
  };
  mutateVicalStore((store) => {
    store.providerOperations.push(row);
  });
  return row;
}

export function listProviderOperationsForBooking(
  workspaceId: string,
  bookingId: string,
): VcalProviderOperation[] {
  return loadVicalStore().providerOperations.filter(
    (op) => op.workspaceId === workspaceId && op.bookingId === bookingId,
  );
}

export function listActionRequiredBookings(workspaceId: string) {
  return loadVicalStore().bookings.filter(
    (b) => b.workspaceId === workspaceId && b.orchestrationStatus === 'action_required',
  );
}

export function reserveWebhookReceipt(input: {
  provider: string;
  eventId: string;
  eventType: string;
  workspaceId?: string;
  payloadSafe: Record<string, unknown>;
}): { receipt: VcalWebhookReceipt; duplicate: boolean } {
  const existing = loadVicalStore().webhookReceipts.find(
    (r) => r.provider === input.provider && r.eventId === input.eventId,
  );
  if (existing) {
    return {
      receipt: { ...existing, status: 'duplicate' },
      duplicate: true,
    };
  }
  const receipt: VcalWebhookReceipt = {
    id: crypto.randomUUID(),
    workspaceId: input.workspaceId,
    provider: input.provider,
    eventId: input.eventId,
    eventType: input.eventType,
    receivedAt: nowIso(),
    status: 'received',
    payloadSafe: input.payloadSafe,
  };
  mutateVicalStore((store) => {
    store.webhookReceipts.push(receipt);
  });
  return { receipt, duplicate: false };
}

export function markWebhookProcessed(receiptId: string, status: 'processed' | 'rejected' = 'processed'): void {
  mutateVicalStore((store) => {
    const idx = store.webhookReceipts.findIndex((r) => r.id === receiptId);
    if (idx < 0) return;
    store.webhookReceipts[idx] = {
      ...store.webhookReceipts[idx]!,
      status,
      processedAt: nowIso(),
    };
  });
}
