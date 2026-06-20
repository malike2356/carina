'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, RefreshCw, Trash2 } from 'lucide-react';

type TerminalEntry = {
  kind: 'system' | 'input' | 'output' | 'error';
  text: string;
  at: string;
};

type TerminalSession = {
  id: string;
  title: string;
  cwd: string;
  transcript: TerminalEntry[];
  lastExitCode: number | null;
  updatedAt: string;
};

function entryClass(kind: TerminalEntry['kind']): string {
  switch (kind) {
    case 'input':
      return 'text-accent';
    case 'error':
      return 'text-danger';
    case 'system':
      return 'text-text-muted';
    default:
      return 'text-text-primary';
  }
}

function splitLines(text: string): string[] {
  const lines = text.split('\n');
  return lines.length > 0 ? lines : [''];
}

export function TerminalWorkspace({ raw = false }: { raw?: boolean }) {
  const [session, setSession] = useState<TerminalSession | null>(null);
  const [sessions, setSessions] = useState<TerminalSession[]>([]);
  const [command, setCommand] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const sessionId = session?.id ?? '';

  const loadSession = async (id?: string) => {
    const url = new URL('/api/terminal', window.location.origin);
    if (id) url.searchParams.set('sessionId', id);
    const res = await fetch(url.toString(), { cache: 'no-store' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Unable to load terminal');
    setSession(data.data?.session ?? null);
    setSessions(data.data?.sessions ?? []);
  };

  useEffect(() => {
    const cached = window.localStorage.getItem('carina_terminal_session') ?? '';
    void (async () => {
      try {
        if (cached) {
          try {
            await loadSession(cached);
            return;
          } catch {
            window.localStorage.removeItem('carina_terminal_session');
          }
        }
        const res = await fetch('/api/terminal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'create' }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Unable to create terminal');
        const next = data.data?.session ?? null;
        setSession(next);
        setSessions(data.data?.sessions ?? []);
        if (next?.id) window.localStorage.setItem('carina_terminal_session', next.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    window.localStorage.setItem('carina_terminal_session', sessionId);
  }, [sessionId]);

  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: 'smooth' });
  }, [session?.transcript.length]);

  async function refresh() {
    if (!sessionId) return;
    try {
      await loadSession(sessionId);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function runCommand() {
    if (!sessionId || !command.trim()) return;
    const cmd = command.trim();
    setBusy(true);
    setError('');
    setCmdHistory((prev) => [cmd, ...prev.filter((c) => c !== cmd)].slice(0, 200));
    setHistoryIdx(-1);
    try {
      const res = await fetch('/api/terminal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, command: cmd }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Command failed');
      setSession(data.data?.session ?? null);
      setSessions(data.data?.sessions ?? []);
      setCommand('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
      if (raw) setTimeout(() => inputRef.current?.focus(), 0);
    }
  }

  function handleRawKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      void runCommand();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const next = Math.min(historyIdx + 1, cmdHistory.length - 1);
      setHistoryIdx(next);
      if (cmdHistory[next] !== undefined) setCommand(cmdHistory[next]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = Math.max(historyIdx - 1, -1);
      setHistoryIdx(next);
      setCommand(next === -1 ? '' : (cmdHistory[next] ?? ''));
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      void clearSession();
    }
  }

  async function newSession() {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/terminal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Unable to create terminal');
      const next = data.data?.session ?? null;
      setSession(next);
      setSessions(data.data?.sessions ?? []);
      setCommand('');
      if (next?.id) window.localStorage.setItem('carina_terminal_session', next.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function clearSession() {
    if (!sessionId) return;
    setBusy(true);
    try {
      await fetch(`/api/terminal?sessionId=${encodeURIComponent(sessionId)}`, { method: 'DELETE' });
      await newSession();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const header = useMemo(() => {
    if (!session) return 'Terminal';
    return `${session.title} · ${session.cwd}`;
  }, [session]);

  const cwdShort = session?.cwd.replace(/^\/home\/[^/]+/, '~') ?? '~';
  const exitOk = (session?.lastExitCode ?? 0) === 0;

  if (raw) {
    return (
      <div
        className="h-full min-h-0 flex flex-col"
        style={{ background: '#0b0f0d', fontFamily: '"JetBrains Mono","Cascadia Code","Fira Code","Courier New",monospace', fontSize: '12px', lineHeight: '18px' }}
        onClick={() => inputRef.current?.focus()}
      >
        {/* Transcript */}
        <div
          ref={transcriptRef}
          className="flex-1 min-h-0 overflow-y-auto"
          style={{ padding: '8px 12px 4px' }}
        >
          {!session ? (
            <span style={{ color: '#2a4a6a' }}>Connecting...</span>
          ) : session.transcript.length === 0 ? (
            <span style={{ color: '#2a4a6a' }}>Terminal ready.</span>
          ) : (
            session.transcript.map((entry, i) => {
              if (entry.kind === 'input') {
                return (
                  <div key={`${entry.at}-${i}`} style={{ color: '#d8e8f4', paddingTop: '3px' }}>
                    <span style={{ color: '#16c97e', userSelect: 'none' }}>$ </span>
                    {entry.text}
                  </div>
                );
              }
              const col =
                entry.kind === 'error'   ? '#f87171' :
                entry.kind === 'system'  ? '#2a4a6a' :
                '#a0bcd0';
              return (
                <div key={`${entry.at}-${i}`}>
                  {splitLines(entry.text).map((line, j) => (
                    <div key={j} style={{ color: col, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                      {line || ' '}
                    </div>
                  ))}
                </div>
              );
            })
          )}
          {busy && <div style={{ color: '#f59e0b' }}>...</div>}
          {error && <div style={{ color: '#f87171', paddingTop: '2px' }}>{error}</div>}
        </div>

        {/* Inline prompt */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '3px 12px 5px', borderTop: '1px solid #122030', flexShrink: 0 }}>
          <span style={{ userSelect: 'none', whiteSpace: 'nowrap', marginRight: '6px' }}>
            <span style={{ color: '#3a8a6e' }}>{cwdShort}</span>
            <span style={{ color: exitOk ? '#16c97e' : '#f87171' }}>{' $'}</span>
          </span>
          <input
            ref={inputRef}
            value={command}
            onChange={(e) => { setCommand(e.target.value); setHistoryIdx(-1); }}
            onKeyDown={handleRawKeyDown}
            disabled={busy}
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#d8e8f4', fontFamily: 'inherit', fontSize: 'inherit', lineHeight: 'inherit', caretColor: '#00d4ff' }}
            spellCheck={false}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-base text-text-primary">
      <div className="border-b border-border bg-surface px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-semibold">{header}</h1>
            <p className="text-xs text-text-muted">
              Run shell commands in a persistent workspace transcript.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={refresh}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-xs text-text-secondary hover:text-text-primary"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
            <button
              type="button"
              onClick={newSession}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-xs text-text-secondary hover:text-text-primary"
            >
              <Plus className="h-3.5 w-3.5" />
              New session
            </button>
            <button
              type="button"
              onClick={clearSession}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-xs text-danger hover:bg-danger/10"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear
            </button>
          </div>
        </div>
        {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
      </div>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-56 shrink-0 border-r border-border bg-surface/80 p-3 lg:flex lg:flex-col">
          <p className="px-1 pb-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
            Sessions
          </p>
          <div className="flex-1 space-y-1 overflow-y-auto">
            {sessions.length === 0 ? (
              <p className="px-1 py-2 text-xs text-text-muted">No saved terminal sessions yet.</p>
            ) : (
              sessions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => void loadSession(item.id)}
                  className={[
                    'flex w-full flex-col rounded-md px-2 py-2 text-left text-xs transition-colors',
                    item.id === sessionId
                      ? 'bg-elevated text-text-primary'
                      : 'text-text-secondary hover:bg-elevated hover:text-text-primary',
                  ].join(' ')}
                >
                  <span className="truncate font-medium">{item.title}</span>
                  <span className="truncate text-[11px] text-text-muted">{item.cwd}</span>
                </button>
              ))
            )}
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <div
            ref={transcriptRef}
            className="flex-1 overflow-y-auto border-b border-border bg-[#0b0f0d] px-4 py-3 font-mono text-[12px] leading-5"
          >
            {!session ? (
              <p className="text-text-muted">Loading terminal...</p>
            ) : (
              session.transcript.map((entry, index) => (
                <div key={`${entry.at}-${index}`} className={entryClass(entry.kind)}>
                  {splitLines(entry.text).map((line, lineIndex) => (
                    <div key={`${entry.at}-${index}-${lineIndex}`}>
                      {line.length > 0 ? line : '\u00a0'}
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>

          <form
            className="border-t border-border bg-surface p-3"
            onSubmit={(event) => {
              event.preventDefault();
              void runCommand();
            }}
          >
            <label className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              Command
            </label>
            <div className="flex gap-2">
              <input
                value={command}
                onChange={(event) => setCommand(event.target.value)}
                placeholder="ls -la"
                className="min-w-0 flex-1 rounded-md border border-border bg-base px-3 py-2 font-mono text-sm outline-none"
                spellCheck={false}
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                disabled={busy}
              />
              <button
                type="submit"
                disabled={busy || !command.trim()}
                className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                Run
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-text-muted">
              <span>{session?.lastExitCode == null ? 'No command run yet' : `Last exit code ${session.lastExitCode}`}</span>
              <span>{busy ? 'Running...' : 'Commands are executed on the server shell'}</span>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
