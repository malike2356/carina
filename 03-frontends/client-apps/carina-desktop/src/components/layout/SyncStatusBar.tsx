import { useStore } from '@nanostores/react';
import { $syncStatus, $lastSyncAt, $syncError } from '../../store/sync.js';

const LABEL: Record<string, string> = {
  synced: 'Synced',
  syncing: 'Syncing...',
  offline: 'Offline',
  pending: 'Changes pending',
};

const DOT: Record<string, string> = {
  synced: 'bg-green-400',
  syncing: 'bg-amber-400 animate-pulse',
  offline: 'bg-red-400',
  pending: 'bg-amber-400',
};

interface Props {
  compact?: boolean;
  onSyncNow?: () => void;
}

export default function SyncStatusBar({ compact = false, onSyncNow }: Props) {
  const status = useStore($syncStatus);
  const lastSyncAt = useStore($lastSyncAt);
  const syncError = useStore($syncError);

  const lastLabel = lastSyncAt
    ? new Date(lastSyncAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'never';

  if (compact) {
    return (
      <button
        type="button"
        title={`${LABEL[status]} (last sync ${lastLabel})`}
        onClick={() => onSyncNow?.()}
        className="flex justify-center w-full py-1"
      >
        <span className={`inline-block w-2 h-2 rounded-full ${DOT[status]}`} />
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-2 py-2 space-y-1">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${DOT[status]}`} />
          <span className="text-[11px] text-zinc-300 truncate">{LABEL[status]}</span>
        </div>
        {onSyncNow && (
          <button
            type="button"
            onClick={() => void onSyncNow()}
            className="text-[10px] text-indigo-300 hover:text-indigo-200 shrink-0"
          >
            Sync now
          </button>
        )}
      </div>
      <p className="text-[10px] text-zinc-600">Last sync: {lastLabel}</p>
      {syncError && <p className="text-[10px] text-red-400 truncate" title={syncError}>{syncError}</p>}
    </div>
  );
}
