'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle, ExternalLink, Loader2 } from 'lucide-react';
import type { CalendarConnectionView, CalendarProvider } from '@/lib/calendar-connection';

type CalendarConnectionPanelProps = {
  backHref?: string;
  backLabel?: string;
  title?: string;
};

export function CalendarConnectionPanel({
  backHref = '/calendar',
  backLabel = 'Back to calendar',
  title = 'Calendar settings',
}: CalendarConnectionPanelProps) {
  const [connection, setConnection] = useState<CalendarConnectionView | null>(null);
  const [platformGoogleConfigured, setPlatformGoogleConfigured] = useState(false);
  const [envConfigured, setEnvConfigured] = useState(false);
  const [provider, setProvider] = useState<CalendarProvider>('google');
  const [url, setUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [refreshToken, setRefreshToken] = useState('');
  const [calendarId, setCalendarId] = useState('primary');
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testOk, setTestOk] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [oauthMessage, setOauthMessage] = useState<string | null>(null);

  const oauthReady = useMemo(() => {
    if (provider !== 'google') return false;
    return Boolean(clientId.trim() || platformGoogleConfigured);
  }, [provider, clientId, platformGoogleConfigured]);

  async function load() {
    const res = await fetch('/api/calendar/connection');
    const data = (await res.json()) as {
      data?: CalendarConnectionView | null;
      envConfigured?: boolean;
      platformGoogleConfigured?: boolean;
      oauth?: { connected?: boolean; error?: string };
    };
    setConnection(data.data ?? null);
    setEnvConfigured(Boolean(data.envConfigured));
    setPlatformGoogleConfigured(Boolean(data.platformGoogleConfigured));

    if (data.oauth?.connected) {
      setOauthMessage('Google Calendar connected successfully.');
    } else if (data.oauth?.error) {
      setOauthMessage(data.oauth.error);
    }

    if (data.data) {
      setProvider(data.data.provider);
      setEnabled(data.data.enabled);
      if (data.data.provider === 'google') {
        setClientId(data.data.clientId ?? '');
        setCalendarId(data.data.calendarId ?? 'primary');
      } else {
        setUrl(data.data.url ?? '');
        setUsername(data.data.username ?? '');
      }
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setTestOk(null);

    const body =
      provider === 'google'
        ? {
            provider: 'google',
            clientId,
            clientSecret: clientSecret || undefined,
            refreshToken: refreshToken || undefined,
            calendarId,
            enabled,
          }
        : {
            provider: 'caldav',
            url,
            username,
            password: password || undefined,
            enabled,
          };

    const res = await fetch('/api/calendar/connection', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error || 'Save failed');
      return;
    }
    setPassword('');
    setClientSecret('');
    setRefreshToken('');
    await load();
  }

  async function testConnection() {
    setTesting(true);
    setTestOk(null);
    setError(null);

    const body =
      provider === 'google'
        ? {
            provider: 'google',
            clientId,
            clientSecret: clientSecret || undefined,
            refreshToken: refreshToken || undefined,
            calendarId,
          }
        : {
            provider: 'caldav',
            url,
            username,
            password: password || undefined,
          };

    const res = await fetch('/api/calendar/connection/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setTesting(false);
    if (!res.ok) {
      setError(data.error || 'Test failed');
      return;
    }
    setTestOk(
      provider === 'google'
        ? `Google Calendar (${data.data?.calendarId ?? calendarId})`
        : (data.data?.calendarUrl ?? 'Connected'),
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <Link
        href={backHref}
        className="mb-4 inline-flex items-center gap-1 text-xs text-text-muted hover:text-text-primary"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> {backLabel}
      </Link>
      <h1 className="text-lg font-semibold text-text-primary">{title}</h1>
      <p className="mt-1 text-xs text-text-muted">
        Connect Google Calendar with OAuth credentials, or use CalDAV for Nextcloud, Radicale, and similar servers.
      </p>

      {envConfigured && provider === 'caldav' ? (
        <p className="mt-4 rounded-md border border-border bg-elevated px-3 py-2 text-xs text-text-secondary">
          Server env fallback is configured (`CALDAV_URL`, `CALDAV_USERNAME`, `CALDAV_PASSWORD`).
        </p>
      ) : null}

      {oauthMessage ? (
        <p className="mt-4 rounded-md border border-border bg-elevated px-3 py-2 text-xs text-text-secondary">
          {oauthMessage}
        </p>
      ) : null}

      <div className="mt-6 flex gap-2">
        <button
          type="button"
          onClick={() => setProvider('google')}
          className={
            provider === 'google'
              ? 'rounded-md bg-accent px-3 py-1.5 text-xs text-black'
              : 'rounded-md border border-border px-3 py-1.5 text-xs text-text-secondary hover:bg-elevated'
          }
        >
          Google Calendar
        </button>
        <button
          type="button"
          onClick={() => setProvider('caldav')}
          className={
            provider === 'caldav'
              ? 'rounded-md bg-accent px-3 py-1.5 text-xs text-black'
              : 'rounded-md border border-border px-3 py-1.5 text-xs text-text-secondary hover:bg-elevated'
          }
        >
          CalDAV
        </button>
      </div>

      <form onSubmit={save} className="mt-6 space-y-4">
        {provider === 'google' ? (
          <>
            <div className="rounded-lg border border-border bg-surface p-4 text-xs text-text-secondary">
              <p className="font-medium text-text-primary">Google Cloud setup</p>
              <ol className="mt-2 list-decimal space-y-1 pl-4">
                <li>Create an OAuth client in Google Cloud Console (Web application).</li>
                <li>
                  Add redirect URI:{' '}
                  <code className="rounded bg-elevated px-1 py-0.5">
                    {typeof window !== 'undefined'
                      ? `${window.location.origin}/api/calendar/google/callback`
                      : 'https://app.carinaai.uk/api/calendar/google/callback'}
                  </code>
                </li>
                <li>Enable the Google Calendar API for the project.</li>
                <li>Paste client ID and secret below, then connect or paste a refresh token.</li>
              </ol>
              <a
                href="https://console.cloud.google.com/apis/credentials"
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-1 text-accent hover:text-accent-hover"
              >
                Open Google Cloud Console <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>

            {platformGoogleConfigured && !clientId ? (
              <p className="text-xs text-text-muted">
                Platform Google OAuth is configured. You can connect without entering a client ID, or use your own
                OAuth client (BYOK).
              </p>
            ) : null}

            <label className="block text-xs text-text-secondary">
              OAuth client ID
              <input
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder={platformGoogleConfigured ? 'Optional if platform OAuth is configured' : '123456.apps.googleusercontent.com'}
                className="mt-1 w-full rounded-md border border-border bg-elevated px-3 py-2 text-sm text-text-primary"
              />
            </label>
            <label className="block text-xs text-text-secondary">
              OAuth client secret {connection?.hasGoogleSecrets ? '(leave blank to keep current)' : ''}
              <input
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-elevated px-3 py-2 text-sm text-text-primary"
              />
            </label>
            <label className="block text-xs text-text-secondary">
              Refresh token {connection?.hasGoogleSecrets ? '(leave blank to keep current)' : ''}
              <input
                type="password"
                value={refreshToken}
                onChange={(e) => setRefreshToken(e.target.value)}
                placeholder="1//0g..."
                className="mt-1 w-full rounded-md border border-border bg-elevated px-3 py-2 text-sm text-text-primary"
              />
            </label>
            <label className="block text-xs text-text-secondary">
              Calendar ID
              <input
                value={calendarId}
                onChange={(e) => setCalendarId(e.target.value)}
                placeholder="primary or your@gmail.com"
                className="mt-1 w-full rounded-md border border-border bg-elevated px-3 py-2 text-sm text-text-primary"
              />
            </label>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!oauthReady}
                onClick={() => {
                  void (async () => {
                    if (clientId.trim() || clientSecret.trim() || calendarId.trim()) {
                      const res = await fetch('/api/calendar/connection', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          provider: 'google',
                          clientId,
                          clientSecret: clientSecret || undefined,
                          calendarId,
                          enabled: true,
                        }),
                      });
                      if (!res.ok) {
                        const data = (await res.json()) as { error?: string };
                        setError(data.error ?? 'Could not save Google credentials before OAuth');
                        return;
                      }
                    }
                    const params = new URLSearchParams();
                    if (clientId.trim()) params.set('clientId', clientId.trim());
                    window.location.href = `/api/calendar/google/authorize?${params.toString()}`;
                  })();
                }}
                className={
                  oauthReady
                    ? 'rounded-md border border-border px-3 py-2 text-xs text-text-primary hover:bg-elevated'
                    : 'cursor-not-allowed rounded-md border border-border px-3 py-2 text-xs text-text-muted opacity-60'
                }
              >
                Connect with Google
              </button>
            </div>
          </>
        ) : (
          <>
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
          </>
        )}

        <label className="flex items-center gap-2 text-xs text-text-secondary">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Enable calendar sync for this workspace
        </label>

        {connection?.lastSyncAt ? (
          <p className="text-xs text-text-muted">
            Last sync: {new Date(connection.lastSyncAt).toLocaleString()}
          </p>
        ) : null}
        {connection?.lastSyncError ? (
          <p className="text-xs text-danger">Last sync error: {connection.lastSyncError}</p>
        ) : null}
        {error ? <p className="text-xs text-danger">{error}</p> : null}
        {testOk ? (
          <p className="flex items-center gap-1 text-xs text-emerald-400">
            <CheckCircle className="h-3.5 w-3.5" /> Connected to {testOk}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-accent px-3 py-2 text-xs text-black disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            type="button"
            onClick={() => void testConnection()}
            disabled={testing}
            className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-2 text-xs text-text-secondary hover:bg-elevated"
          >
            {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Test connection
          </button>
        </div>
      </form>

      <div className="mt-8 rounded-lg border border-border p-4 text-xs text-text-muted">
        <p className="font-semibold text-text-secondary">After connecting</p>
        <p className="mt-1">
          Open the Calendar page and run Sync to import events into this workspace. Carina reads events; it does not
          replace Google Calendar or your CalDAV client.
        </p>
      </div>
    </div>
  );
}
