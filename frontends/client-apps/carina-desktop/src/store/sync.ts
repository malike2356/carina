import { atom, computed } from 'nanostores';
import type { SyncStatus } from '../lib/offline/types.js';
import { getSyncMeta } from '../lib/offline/cache.js';
import { $gatewayStatus } from './connection.js';

export const $syncPhase = atom<'idle' | 'pull' | 'push'>('idle');
export const $lastSyncAt = atom<string | null>(getSyncMeta().lastSyncAt);
export const $pendingChanges = atom<number>(getSyncMeta().pendingChanges);
export const $syncError = atom<string | null>(null);

export const $syncStatus = computed([$gatewayStatus, $syncPhase, $pendingChanges], (gateway, phase, pending): SyncStatus => {
  if (gateway === 'down') return pending > 0 ? 'pending' : 'offline';
  if (phase !== 'idle') return 'syncing';
  if (pending > 0) return 'pending';
  return 'synced';
});

export function setSyncRunning(phase: 'pull' | 'push' | 'idle'): void {
  $syncPhase.set(phase === 'idle' ? 'idle' : phase);
}

export function refreshSyncMeta(): void {
  const meta = getSyncMeta();
  $lastSyncAt.set(meta.lastSyncAt);
  $pendingChanges.set(meta.pendingChanges);
}
