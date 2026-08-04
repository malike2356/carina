'use client';

import { FormEvent, useCallback, useEffect, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Status = {
  scopeKind: 'workspace' | 'user' | 'shared';
  scopeId: string | null;
  scopeKey: string;
  configured: boolean;
  enabled: boolean;
  hasToken: boolean;
  repo: string | null;
  branch: string;
  cloneExists: boolean;
  allowedFolders: string[];
  pullIntervalMinutes?: number;
  pushIntervalMinutes?: number;
  humanEditsWin?: boolean;
  lastPullAt: string | null;
  lastPushAt: string | null;
  lastIndexAt: string | null;
  lastError: string | null;
  indexedChunks: number;
};

type SearchHit = {
  path: string;
  score: number;
  snippet: string;
};

const DEFAULT_FOLDERS = 'memory, skills, plans, AGENTS.md';

type ScopeKind = 'workspace' | 'user';

function scopeQuery(scopeKind: ScopeKind): string {
  return `?scopeKind=${encodeURIComponent(scopeKind)}`;
}

function Toggle({
  value,
  onChange,
  label,
  description,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-text-primary">{label}</p>
        {description ? <p className="mt-0.5 text-xs text-text-muted">{description}</p> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={cn(
          'relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors',
          value ? 'bg-accent' : 'border-border bg-elevated',
        )}
      >
        <span
          className={cn(
            'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition',
            value ? 'translate-x-4' : 'translate-x-0',
          )}
        />
      </button>
    </div>
  );
}

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block text-xs font-medium text-text-secondary">
      {label}
      <div className="mt-1.5">{children}</div>
      {hint ? <p className="mt-1 text-[11px] font-normal text-text-muted">{hint}</p> : null}
    </label>
  );
}

const inputClass =
  'w-full rounded-md border border-border bg-elevated px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-border-focus';

function parseRepoSlug(raw: string): { owner: string; repo: string } | null {
  const trimmed = raw.trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/, '');
  const parts = trimmed.split('/').filter(Boolean);
  if (parts.length < 2) return null;
  return { owner: parts[0]!, repo: parts[1]! };
}

interface AgentSyncSettingsProps {
  embedded?: boolean;
}

export function AgentSyncSettings({ embedded = false }: AgentSyncSettingsProps) {
  const [status, setStatus] = useState<Status | null>(null);
  const [scopeKind, setScopeKind] = useState<ScopeKind>('workspace');
  const [enabled, setEnabled] = useState(false);
  const [repoSlug, setRepoSlug] = useState('');
  const [branch, setBranch] = useState('main');
  const [pullMinutes, setPullMinutes] = useState(15);
  const [pushMinutes, setPushMinutes] = useState(0);
  const [folders, setFolders] = useState(DEFAULT_FOLDERS);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showConfig, setShowConfig] = useState(!embedded);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/agent-sync${scopeQuery(scopeKind)}`);
    const data = (await res.json()) as Status & { error?: string };
    if (!res.ok) {
      setError(data.error || 'Failed to load GitHub memory status');
      setLoaded(true);
      return;
    }
    setError('');
    setStatus(data);
    setScopeKind((data.scopeKind === 'user' ? 'user' : 'workspace') as ScopeKind);
    setEnabled(Boolean(data.enabled));
    setRepoSlug(data.repo || '');
    setBranch(data.branch || 'main');
    setFolders((data.allowedFolders || []).join(', ') || DEFAULT_FOLDERS);
    if (typeof data.pullIntervalMinutes === 'number') setPullMinutes(data.pullIntervalMinutes);
    if (typeof data.pushIntervalMinutes === 'number') setPushMinutes(data.pushIntervalMinutes);
    if (embedded) {
      const needsSetup = !data.repo || !data.hasToken;
      setShowConfig(needsSetup);
    }
    setLoaded(true);
  }, [scopeKind, embedded]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function save(event?: FormEvent) {
    event?.preventDefault();
    setBusy(true);
    setMessage('');
    setError('');
    try {
      const parsed = parseRepoSlug(repoSlug);
      if (!parsed) {
        throw new Error('Enter a GitHub repo as owner/name (for example you/agent-memory)');
      }
      const body: Record<string, unknown> = {
        scopeKind,
        enabled,
        owner: parsed.owner,
        repo: parsed.repo,
        branch: branch.trim() || 'main',
        pullIntervalMinutes: Math.max(1, Number(pullMinutes) || 15),
        pushIntervalMinutes: Math.max(0, Number(pushMinutes) || 0),
        allowedFolders: folders
          .split(',')
          .map((part) => part.trim())
          .filter(Boolean),
        product: 'shared',
        humanEditsWin: true,
      };
      if (token.trim()) body.token = token.trim();
      const res = await fetch(`/api/agent-sync/settings${scopeQuery(scopeKind)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setToken('');
      setMessage('Saved. Use Sync now to pull your memory repo.');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function runPull() {
    setBusy(true);
    setMessage('');
    setError('');
    try {
      const res = await fetch(`/api/agent-sync/pull${scopeQuery(scopeKind)}`, { method: 'POST' });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Sync failed');
      setMessage(`Synced. Indexed ${data.indexed ?? 0} notes.`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function runPush() {
    setBusy(true);
    setMessage('');
    setError('');
    try {
      const res = await fetch(`/api/agent-sync/push${scopeQuery(scopeKind)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scopeKind }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Push failed');
      setMessage(
        data.pushed
          ? `Pushed ${data.committedFiles?.length ?? 0} note(s) to GitHub.`
          : 'Nothing new to push.',
      );
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function runSearch(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    setError('');
    try {
      const res = await fetch(`/api/agent-sync/search${scopeQuery(scopeKind)}&q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Search failed');
      setHits(Array.isArray(data.hits) ? data.hits : []);
      setMessage(`${(data.hits || []).length} hit(s)`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) {
    return (
      <div className="rounded-lg border border-border bg-surface px-4 py-6 text-xs text-text-muted">
        Loading GitHub memory…
      </div>
    );
  }

  const statusItems = [
    { label: 'Repo', value: status?.repo || 'not linked' },
    {
      label: 'Status',
      value: status?.enabled ? (status.cloneExists ? 'linked' : 'enabled, not synced') : 'off',
    },
    { label: 'Token', value: status?.hasToken ? 'saved' : 'missing' },
    { label: 'Indexed', value: String(status?.indexedChunks ?? 0) },
    { label: 'Last sync', value: status?.lastPullAt || '-' },
    { label: 'Last push', value: status?.lastPushAt || '-' },
  ];

  return (
    <div className="space-y-4" id="agent-sync">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 max-w-2xl">
          <h2
            className={cn(
              'mb-1 font-medium text-text-secondary',
              embedded ? 'text-sm' : 'text-base text-text-primary',
            )}
          >
            GitHub memory
          </h2>
          <p className="text-xs text-text-muted">
            Link agent memory to a private GitHub repo. Notes stay in Git, sync on a schedule, and
            agents can search them. Secrets and chat transcripts are never committed.
          </p>
        </div>
        {embedded ? (
          <button
            type="button"
            onClick={() => setShowConfig((value) => !value)}
            className="shrink-0 rounded-md border border-border px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary"
          >
            {showConfig ? 'Hide connection' : 'Edit connection'}
          </button>
        ) : null}
      </div>

      <dl className="grid gap-3 rounded-lg border border-border bg-surface px-4 py-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {statusItems.map((item) => (
          <div key={item.label} className="min-w-0">
            <dt className="text-[11px] uppercase tracking-wide text-text-muted">{item.label}</dt>
            <dd className="mt-0.5 truncate text-xs text-text-primary" title={item.value}>
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
      {status?.lastError ? (
        <p className="text-xs text-red-500">Last error: {status.lastError}</p>
      ) : null}

      {showConfig ? (
        <form onSubmit={(e) => void save(e)} className="space-y-4 rounded-lg border border-border bg-surface p-4">
          <Toggle
            value={enabled}
            onChange={setEnabled}
            label="Use GitHub for agent memory"
            description="Pull approved notes into the agent, and push durable updates back to your repo."
          />

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Field
              label="Scope"
              hint="Workspace is tenant-wide. User keeps the link private to this account."
            >
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setScopeKind('workspace')}
                  className={cn(
                    'rounded-md border px-3 py-1.5 text-xs',
                    scopeKind === 'workspace'
                      ? 'border-border-focus bg-accent/10 text-text-primary'
                      : 'border-border text-text-muted',
                  )}
                >
                  Workspace
                </button>
                <button
                  type="button"
                  onClick={() => setScopeKind('user')}
                  className={cn(
                    'rounded-md border px-3 py-1.5 text-xs',
                    scopeKind === 'user'
                      ? 'border-border-focus bg-accent/10 text-text-primary'
                      : 'border-border text-text-muted',
                  )}
                >
                  User
                </button>
              </div>
            </Field>

            <Field label="GitHub repo" hint="owner/name or github.com URL. Private recommended.">
              <input
                className={inputClass}
                value={repoSlug}
                onChange={(e) => setRepoSlug(e.target.value)}
                placeholder="you/agent-memory"
                autoComplete="off"
              />
            </Field>

            <Field label="Branch">
              <input
                className={inputClass}
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                placeholder="main"
              />
            </Field>

            <Field label="Sync every (minutes)">
              <input
                type="number"
                min={1}
                className={inputClass}
                value={pullMinutes}
                onChange={(e) => setPullMinutes(Number(e.target.value))}
              />
            </Field>

            <Field
              label="GitHub token"
              hint="Fine-grained PAT or GitHub App token with Contents read/write. Leave blank to keep the current token."
            >
              <input
                type="password"
                className={inputClass}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="github_pat_... or ghs_..."
                autoComplete="off"
              />
            </Field>
          </div>

          <button
            type="button"
            className="text-xs text-accent hover:underline"
            onClick={() => setShowAdvanced((value) => !value)}
          >
            {showAdvanced ? 'Hide advanced' : 'Show advanced'}
          </button>

          {showAdvanced ? (
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Folders to sync (comma separated)">
                <input
                  className={inputClass}
                  value={folders}
                  onChange={(e) => setFolders(e.target.value)}
                />
              </Field>
              <Field label="Auto-push every (minutes, 0 = manual only)">
                <input
                  type="number"
                  min={0}
                  className={inputClass}
                  value={pushMinutes}
                  onChange={(e) => setPushMinutes(Number(e.target.value))}
                />
              </Field>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              disabled={busy || !enabled}
              onClick={() => void runPull()}
              className="rounded-md border border-border px-3 py-1.5 text-xs text-text-primary disabled:opacity-50"
            >
              Sync now
            </button>
            <button
              type="button"
              disabled={busy || !enabled}
              onClick={() => void runPush()}
              className="rounded-md border border-border px-3 py-1.5 text-xs text-text-primary disabled:opacity-50"
            >
              Push notes
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm text-text-primary">
              {enabled ? 'GitHub memory enabled' : 'GitHub memory off'}
            </p>
            <p className="mt-0.5 text-xs text-text-muted">
              {status?.repo
                ? `${status.repo} · ${status.hasToken ? 'token saved' : 'token missing'}`
                : 'Not linked yet. Edit connection to set repo and token.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || !enabled}
              onClick={() => void runPull()}
              className="rounded-md border border-border px-3 py-1.5 text-xs text-text-primary disabled:opacity-50"
            >
              Sync now
            </button>
            <button
              type="button"
              disabled={busy || !enabled}
              onClick={() => void runPush()}
              className="rounded-md border border-border px-3 py-1.5 text-xs text-text-primary disabled:opacity-50"
            >
              Push notes
            </button>
          </div>
        </div>
      )}

      <form
        onSubmit={(e) => void runSearch(e)}
        className="space-y-3 rounded-lg border border-border bg-surface p-4"
      >
        <h3 className="text-sm text-text-primary">Search memory</h3>
        <div className="flex max-w-2xl gap-2">
          <input
            className={inputClass}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="preferences, projects, decisions…"
          />
          <button
            type="submit"
            disabled={busy || !query.trim()}
            className="shrink-0 rounded-md border border-border px-3 py-1.5 text-xs disabled:opacity-50"
          >
            Search
          </button>
        </div>
        <ul className="grid gap-2 lg:grid-cols-2">
          {hits.map((hit) => (
            <li
              key={`${hit.path}-${hit.score}-${hit.snippet.slice(0, 12)}`}
              className="rounded-md border border-border p-3"
            >
              <div className="text-xs font-medium text-text-primary">
                {hit.path}{' '}
                <span className="font-normal text-text-muted">score {hit.score}</span>
              </div>
              <div className="mt-1 text-xs text-text-muted">{hit.snippet}</div>
            </li>
          ))}
        </ul>
      </form>

      {message ? <p className="text-xs text-text-secondary">{message}</p> : null}
      {error ? <p className="text-xs text-red-500">{error}</p> : null}
    </div>
  );
}
