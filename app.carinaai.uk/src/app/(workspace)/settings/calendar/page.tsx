'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle, Loader2 } from 'lucide-react';

interface ConnectionView {
  url: string | null;
  username: string | null;
  enabled: boolean;
  hasPassword: boolean;
  lastSyncAt: string | null;
  lastSyncError: string | null;
}

export default function CalendarSettingsPage() {
  const [connection, setConnection] = useState<ConnectionView | null>(null);
  const [envConfigured, setEnvConfigured] = useState(false);
  const [url, setUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testOk, setTestOk] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch('/api/calendar/connection');
    const data = await res.json();
    setConnection(data.data);
    setEnvConfigured(Boolean(data.envConfigured));
    if (data.data) {
      setUrl(data.data.url ?? '');
      setUsername(data.data.username ?? '');
      setEnabled(data.data.enabled);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch('/api/calendar/connection', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, username, password: password || undefined, enabled }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error || 'Save failed');
      return;
    }
    setPassword('');
    await load();
  }

  async function testConnection() {
    setTesting(true);
    setTestOk(null);
    setError(null);
    const res = await fetch('/api/calendar/connection/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, username, password: password || undefined }),
    });
    const data = await res.json();
    setTesting(false);
    if (!res.ok) {
      setError(data.error || 'Test failed');
      return;
    }
    setTestOk(data.data?.calendarUrl ?? 'Connected');
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <Link href="/calendar" className="mb-4 inline-flex items-center gap-1 text-xs text-text-muted hover:text-text-primary">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to calendar
      </Link>
      <h1 className="text-lg font-semibold text-text-primary">Calendar settings</h1>
      <p className="mt-1 text-xs text-text-muted">
        Connect CalDAV (Radicale, Nextcloud, and similar). Passwords are encrypted per workspace.
      </p>

      {envConfigured && (
        <p className="mt-4 rounded-md border border-border bg-elevated px-3 py-2 text-xs text-text-secondary">
          Server env fallback is configured (`CALDAV_URL`, `CALDAV_USERNAME`, `CALDAV_PASSWORD`).
        </p>
      )}

      <form onSubmit={save} className="mt-6 space-y-4">
        <label className="block text-xs text-text-secondary">
          CalDAV URL
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://caldav.example.com/user/calendar/"
            className="mt-1 w-full rounded-md border border-border bg-elevated px-3 py-2 text-sm text-text-primary"
          />
        </label>
        <label className="block text-xs text-text-secondary">
          Username
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-elevated px-3 py-2 text-sm text-text-primary"
          />
        </label>
        <label className="block text-xs text-text-secondary">
          Password {connection?.hasPassword ? '(leave blank to keep current)' : ''}
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-elevated px-3 py-2 text-sm text-text-primary"
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-text-secondary">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Enable CalDAV sync for this workspace
        </label>

        {connection?.lastSyncAt && (
          <p className="text-xs text-text-muted">Last sync: {new Date(connection.lastSyncAt).toLocaleString()}</p>
        )}
        {connection?.lastSyncError && (
          <p className="text-xs text-danger">Last sync error: {connection.lastSyncError}</p>
        )}
        {error && <p className="text-xs text-danger">{error}</p>}
        {testOk && (
          <p className="flex items-center gap-1 text-xs text-emerald-400">
            <CheckCircle className="h-3.5 w-3.5" /> Connected to {testOk}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={saving} className="rounded-md bg-accent px-3 py-2 text-xs text-white disabled:opacity-50">
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            type="button"
            onClick={testConnection}
            disabled={testing}
            className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-2 text-xs text-text-secondary hover:bg-elevated"
          >
            {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Test connection
          </button>
        </div>
      </form>

      <div className="mt-8 rounded-lg border border-border p-4 text-xs text-text-muted">
        <p className="font-semibold text-text-secondary">Self-hosted core</p>
        <p className="mt-1">
          Self-hosted core can use env-based CalDAV. Cloud only imports events you sync here; it does not replace a full mail/calendar client.
        </p>
      </div>
    </div>
  );
}
