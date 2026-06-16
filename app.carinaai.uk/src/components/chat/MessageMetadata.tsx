import { useAppearance } from '@/hooks/useAppearance';

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTokens(n: number): string {
  if (n === 0) return '';
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k tok`;
  return `${n} tok`;
}

export function MessageMetadata({
  outputTokens,
  durationMs,
  model,
}: {
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  model?: string;
}) {
  const appearance = useAppearance();
  const parts: string[] = [];
  if (appearance.showTokenCounts && outputTokens > 0) parts.push(formatTokens(outputTokens));
  if (durationMs > 0) parts.push(formatDuration(durationMs));
  if (model) parts.push(model);

  if (parts.length === 0) return null;

  return (
    <div className="mt-1.5 flex items-center gap-2 font-mono text-[10px] text-text-muted">
      {parts.map((part, index) => (
        <span key={part}>
          {index > 0 && <span className="mx-1 opacity-40">-</span>}
          {part}
        </span>
      ))}
    </div>
  );
}
