import crypto from 'crypto';
import { mutateVicalStore, loadVicalStore } from './store.js';
import type { VcalSlotLock } from './types.js';

const DEFAULT_LOCK_TTL_MS = 3 * 60_000;

function nowIso(d = new Date()): string {
  return d.toISOString();
}

export function pruneExpiredLocks(now = new Date()): number {
  let removed = 0;
  const nowMs = now.getTime();
  mutateVicalStore((store) => {
    const before = store.slotLocks.length;
    store.slotLocks = store.slotLocks.filter((lock) => new Date(lock.expiresAt).getTime() > nowMs);
    removed = before - store.slotLocks.length;
  });
  return removed;
}

export function listActiveLocks(workspaceId: string, hostUserId?: string, now = new Date()): VcalSlotLock[] {
  pruneExpiredLocks(now);
  return loadVicalStore().slotLocks.filter(
    (lock) =>
      lock.workspaceId === workspaceId &&
      (!hostUserId || lock.hostUserId === hostUserId) &&
      new Date(lock.expiresAt).getTime() > now.getTime(),
  );
}

export function acquireSlotLock(input: {
  workspaceId: string;
  hostUserId: string;
  startsAt: string;
  endsAt: string;
  ttlMs?: number;
  now?: Date;
}): VcalSlotLock {
  const now = input.now ?? new Date();
  pruneExpiredLocks(now);
  const startMs = new Date(input.startsAt).getTime();
  const endMs = new Date(input.endsAt).getTime();
  const active = listActiveLocks(input.workspaceId, input.hostUserId, now);
  const conflict = active.some((lock) => {
    const a = new Date(lock.startsAt).getTime();
    const b = new Date(lock.endsAt).getTime();
    return startMs < b && a < endMs;
  });
  if (conflict) {
    throw new Error('Slot lock conflict');
  }

  const lock: VcalSlotLock = {
    id: crypto.randomUUID(),
    workspaceId: input.workspaceId,
    hostUserId: input.hostUserId,
    startsAt: new Date(input.startsAt).toISOString(),
    endsAt: new Date(input.endsAt).toISOString(),
    holderToken: crypto.randomBytes(16).toString('hex'),
    expiresAt: new Date(now.getTime() + (input.ttlMs ?? DEFAULT_LOCK_TTL_MS)).toISOString(),
    createdAt: nowIso(now),
  };

  mutateVicalStore((store) => {
    const stillConflict = store.slotLocks.some((existing) => {
      if (existing.workspaceId !== input.workspaceId || existing.hostUserId !== input.hostUserId) return false;
      if (new Date(existing.expiresAt).getTime() <= now.getTime()) return false;
      const a = new Date(existing.startsAt).getTime();
      const b = new Date(existing.endsAt).getTime();
      return startMs < b && a < endMs;
    });
    if (stillConflict) throw new Error('Slot lock conflict');
    store.slotLocks.push(lock);
  });

  return lock;
}

export function releaseSlotLock(holderToken: string): boolean {
  let released = false;
  mutateVicalStore((store) => {
    const before = store.slotLocks.length;
    store.slotLocks = store.slotLocks.filter((lock) => lock.holderToken !== holderToken);
    released = store.slotLocks.length < before;
  });
  return released;
}
