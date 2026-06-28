import { atom, computed } from 'nanostores';
import { getSyncMeta } from '../lib/offline/cache.js';
import { $gatewayStatus } from './connection.js';
export const $syncPhase = atom('idle');
export const $lastSyncAt = atom(getSyncMeta().lastSyncAt);
export const $pendingChanges = atom(getSyncMeta().pendingChanges);
export const $syncError = atom(null);
export const $syncStatus = computed([$gatewayStatus, $syncPhase, $pendingChanges], (gateway, phase, pending) => {
    if (gateway === 'down')
        return pending > 0 ? 'pending' : 'offline';
    if (phase !== 'idle')
        return 'syncing';
    if (pending > 0)
        return 'pending';
    return 'synced';
});
export function setSyncRunning(phase) {
    $syncPhase.set(phase === 'idle' ? 'idle' : phase);
}
export function refreshSyncMeta() {
    const meta = getSyncMeta();
    $lastSyncAt.set(meta.lastSyncAt);
    $pendingChanges.set(meta.pendingChanges);
}
