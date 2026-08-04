interface Props {
  recording: boolean;
  elapsedMs: number;
  error: string | null;
  disabled?: boolean;
  onToggle: () => void;
}

function formatElapsed(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

export default function VoiceRecorder({
  recording,
  elapsedMs,
  error,
  disabled,
  onToggle,
}: Props) {
  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={onToggle}
        title={error ?? 'Record voice message'}
        className={`rounded-lg border px-2 py-1.5 text-xs ${
          recording
            ? 'border-red-500 text-red-400 ring-2 ring-red-500/30'
            : 'border-zinc-700 text-zinc-400 hover:bg-zinc-800'
        } disabled:opacity-50`}
      >
        Mic
      </button>
      {recording && (
        <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] text-red-400">
          {formatElapsed(elapsedMs)}
        </span>
      )}
    </div>
  );
}
