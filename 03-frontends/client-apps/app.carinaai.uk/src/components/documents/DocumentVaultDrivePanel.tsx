'use client';

import { useCallback, useEffect, useState } from 'react';
import { FolderSync, Link2, RefreshCw, Unplug } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/utils';

type SyncMode = 'outbound_only' | 'inbound_only' | 'two_way';

type Connection = {
  connected: boolean;
  mode: SyncMode;
  accountEmail: string | null;
  googleRootFolderName: string | null;
  lastSyncAt: string | null;
  lastError: string | null;
  watchActive: boolean;
  channelExpiresAt: string | null;
  scopes: string[];
};

const MODE_LABELS: Record<SyncMode, string> = {
  outbound_only: 'Outbound only (drive.file)',
  inbound_only: 'Inbound only (full Drive)',
  two_way: 'Two-way (full Drive)',
};

export function DocumentVaultDrivePanel() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [modes, setModes] = useState<Array<{ mode: SyncMode; consent: string }>>([]);
  const [mode, setMode] = useState<SyncMode>('outbound_only');
  const [rootName, setRootName] = useState('Aiva Document Vault');
  const [consent, setConsent] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/vault/google/connection', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to load Drive connection');
      setConnection(data.data?.connection ?? null);
      setModes(data.data?.modes ?? []);
      if (data.data?.connection?.mode) setMode(data.data.connection.mode);
      const selected = (data.data?.modes ?? []).find(
        (entry: { mode: SyncMode }) => entry.mode === (data.data?.connection?.mode || mode),
      );
      setConsent(selected?.consent || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const selected = modes.find((entry) => entry.mode === mode);
    setConsent(selected?.consent || '');
  }, [mode, modes]);

  async function connect() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/vault/google/connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'auth-url', mode, rootFolderName: rootName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not start OAuth');
      if (data.data?.authUrl) {
        window.location.href = data.data.authUrl;
        return;
      }
      throw new Error('Missing auth URL');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connect failed');
      setBusy(false);
    }
  }

  async function syncNow() {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const res = await fetch('/api/vault/google/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reconcile' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sync failed');
      setStatus(
        `Applied ${data.data?.result?.applied ?? 0}, conflicts ${data.data?.result?.conflicts ?? 0}, skipped ${data.data?.result?.skipped ?? 0}`,
      );
      setConnection(data.data?.connection ?? connection);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setBusy(false);
    }
  }

  async function renewWatch() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/vault/google/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'renew-watch' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Watch renew failed');
      setStatus(data.data?.renewed ? 'Watch renewed' : 'Watch still valid');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Watch renew failed');
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (!window.confirm('Disconnect Google Drive from Document Vault? Watches will stop.')) return;
    setBusy(true);
    try {
      const res = await fetch('/api/vault/google/connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disconnect' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Disconnect failed');
      setConnection(data.data?.connection ?? null);
      setStatus('Disconnected');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Disconnect failed');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="mb-3 flex items-center gap-2">
          <FolderSync className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-semibold text-text-primary">Google Drive sync</h2>
        </div>
        <p className="mb-4 text-xs text-text-muted">
          Prefer drive.file for outbound-only. Full Drive is requested only for inbound or two-way sync,
          with explicit consent. Shared Drives stay disabled until separately enabled.
        </p>

        {connection?.connected ? (
          <div className="space-y-3 text-xs text-text-secondary">
            <p>
              Connected as <span className="font-medium text-text-primary">{connection.accountEmail || 'Google account'}</span>
            </p>
            <p>Mode: {MODE_LABELS[connection.mode]}</p>
            <p>Root: {connection.googleRootFolderName || 'Not set'}</p>
            <p>
              Watch: {connection.watchActive ? 'active' : 'poll / manual only'}
              {connection.channelExpiresAt
                ? ` (expires ${new Date(connection.channelExpiresAt).toLocaleString()})`
                : ''}
            </p>
            <p>Last sync: {connection.lastSyncAt ? new Date(connection.lastSyncAt).toLocaleString() : 'never'}</p>
            {connection.lastError ? <p className="text-danger">{connection.lastError}</p> : null}
            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                disabled={busy || connection.mode === 'outbound_only'}
                onClick={() => void syncNow()}
                className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs text-white disabled:opacity-40"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Reconcile now
              </button>
              <button
                type="button"
                disabled={busy || connection.mode === 'outbound_only'}
                onClick={() => void renewWatch()}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs"
              >
                Renew watch
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void disconnect()}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-danger"
              >
                <Unplug className="h-3.5 w-3.5" />
                Disconnect
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <label className="block text-xs text-text-muted">
              Sync mode
              <select
                value={mode}
                onChange={(event) => setMode(event.target.value as SyncMode)}
                className="mt-1 w-full rounded-md border border-border bg-elevated px-2 py-1.5 text-sm text-text-primary"
              >
                {(Object.keys(MODE_LABELS) as SyncMode[]).map((key) => (
                  <option key={key} value={key}>
                    {MODE_LABELS[key]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-text-muted">
              Google root folder name
              <input
                value={rootName}
                onChange={(event) => setRootName(event.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-elevated px-2 py-1.5 text-sm text-text-primary"
              />
            </label>
            {consent ? (
              <p className={cn('rounded-md border border-border bg-elevated px-3 py-2 text-xs text-text-secondary')}>
                {consent}
              </p>
            ) : null}
            <button
              type="button"
              disabled={busy}
              onClick={() => void connect()}
              className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
            >
              <Link2 className="h-3.5 w-3.5" />
              Connect Google Drive
            </button>
          </div>
        )}

        {status ? <p className="mt-3 text-xs text-emerald-500">{status}</p> : null}
        {error ? <p className="mt-3 text-xs text-danger">{error}</p> : null}
      </div>

      <p className="text-[11px] text-text-muted">
        Legacy Workspace Ops Drive tools remain available for attendance and knowledge folders. Vault sync is the
        canonical Document Vault path and never uses blind last-write-wins.
      </p>
    </div>
  );
}
