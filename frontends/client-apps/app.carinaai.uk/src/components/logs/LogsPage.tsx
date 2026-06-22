'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Filter, Pause, Play, RefreshCw, Search, SignalHigh, Trash2 } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { readJsonResponse } from '@/lib/read-json-response';
import { cn } from '@/lib/utils';

type LogLevel = 'info' | 'warn' | 'error';
type LogSource = 'turn' | 'node-audit' | 'gateway';

type LogLine = {
  ts: string;
  source: LogSource;
  level: LogLevel;
  message: string;
  meta?: Record<string, unknown>;
};

function levelClass(level: LogLevel): string {
  if (level === 'error') return 'text-danger';
  if (level === 'warn') return 'text-amber-400';
  return 'text-accent';
}

function sourceLabel(source: LogSource): string {
  if (source === 'node-audit') return 'Node audit';
  return source;
}

function formatTime(value: string): string {
  return new Date(value).toLocaleString();
}

export function LogsPage() {
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [streaming, setStreaming] = useState(false);
  const [follow, setFollow] = useState(true);
  const [level, setLevel] = useState<LogLevel | 'all'>('all');
  const [source, setSource] = useState<LogSource | 'all'>('all');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<EventSource | null>(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ limit: '150' });
      if (source !== 'all') params.set('source', source);
      const res = await fetch(`/api/ops/logs?${params.toString()}`, { cache: 'no-store' });
      const data = await readJsonResponse<{ logs?: LogLine[]; error?: string }>(res, 'Logs API');
      if (!res.ok) throw new Error(data.error ?? 'Unable to load logs');
      setLogs((data.logs ?? []) as LogLine[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [source]);

  useEffect(() => {
    if (!streaming) {
      streamRef.current?.close();
      streamRef.current = null;
      return;
    }

    const params = new URLSearchParams();
    if (source !== 'all') params.set('source', source);
    const es = new EventSource(`/api/ops/logs/stream?${params.toString()}`);
    streamRef.current = es;
    es.onmessage = (event) => {
      try {
        const line = JSON.parse(event.data) as LogLine;
        setLogs((current) => [line, ...current].slice(0, 250));
      } catch {
        // ignore malformed stream lines
      }
    };
    es.onerror = () => {
      setError('Log stream disconnected.');
      es.close();
    };
    return () => {
      es.close();
      streamRef.current = null;
    };
  }, [streaming, source]);

  useEffect(() => {
    if (!follow) return;
    listRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [logs, follow]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return logs.filter((entry) => {
      if (level !== 'all' && entry.level !== level) return false;
      if (needle) {
        const haystack = [entry.message, entry.source, JSON.stringify(entry.meta ?? {})].join(' ').toLowerCase();
        return haystack.includes(needle);
      }
      return true;
    });
  }, [logs, level, search]);

  function exportJson() {
    const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `carina-logs-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="border-b border-border px-6 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold text-text-primary">Logs</h1>
            <p className="text-xs text-text-muted">
              Search, filter, and follow gateway, node, and turn logs.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-xs text-text-secondary hover:text-text-primary"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => setStreaming((current) => !current)}
              className={cn(
                'inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium',
                streaming ? 'bg-accent text-white' : 'border border-border bg-surface text-text-secondary',
              )}
            >
              {streaming ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              {streaming ? 'Stop follow' : 'Follow stream'}
            </button>
            <button
              type="button"
              onClick={exportJson}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-xs text-text-secondary hover:text-text-primary"
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </button>
          </div>
        </div>
        {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
      </header>

      <div className="border-b border-border bg-surface px-6 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-2 rounded-md border border-border bg-base px-3 py-2 text-xs text-text-secondary">
            <Filter className="h-3.5 w-3.5" />
            <select value={level} onChange={(event) => setLevel(event.target.value as typeof level)}>
              <option value="all">All levels</option>
              <option value="info">Info</option>
              <option value="warn">Warning</option>
              <option value="error">Error</option>
            </select>
          </label>
          <label className="inline-flex items-center gap-2 rounded-md border border-border bg-base px-3 py-2 text-xs text-text-secondary">
            <SignalHigh className="h-3.5 w-3.5" />
            <select value={source} onChange={(event) => setSource(event.target.value as typeof source)}>
              <option value="all">All sources</option>
              <option value="turn">Turn</option>
              <option value="node-audit">Node audit</option>
              <option value="gateway">Gateway</option>
            </select>
          </label>
          <label className="ml-auto flex min-w-64 flex-1 items-center gap-2 rounded-md border border-border bg-base px-3 py-2 text-xs text-text-secondary">
            <Search className="h-3.5 w-3.5" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search log text"
              className="w-full bg-transparent outline-none"
            />
          </label>
          <label className="inline-flex items-center gap-2 text-xs text-text-muted">
            <input type="checkbox" checked={follow} onChange={(event) => setFollow(event.target.checked)} />
            Follow newest
          </label>
        </div>
      </div>

      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto p-4">
        {loading ? (
          <EmptyState title="Loading logs" subtitle="Pulling the latest entries from the core log store." />
        ) : filtered.length === 0 ? (
          <EmptyState title="No matching logs" subtitle="Adjust filters or clear the search field." />
        ) : (
          <div className="space-y-2">
            {filtered.map((entry) => (
              <article key={`${entry.ts}-${entry.source}-${entry.message}`} className="rounded-lg border border-border bg-surface px-4 py-3">
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="text-text-muted">{formatTime(entry.ts)}</span>
                  <span className={cn('font-medium uppercase', levelClass(entry.level))}>{entry.level}</span>
                  <span className="text-text-muted">{sourceLabel(entry.source)}</span>
                </div>
                <p className="mt-1 text-sm text-text-primary">{entry.message}</p>
                {entry.meta ? (
                  <details className="mt-2 text-xs text-text-muted">
                    <summary className="cursor-pointer select-none">Details</summary>
                    <pre className="mt-2 overflow-x-auto rounded-md bg-base p-3 text-[11px] text-text-secondary">
                      {JSON.stringify(entry.meta, null, 2)}
                    </pre>
                  </details>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
