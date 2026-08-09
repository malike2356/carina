'use client';

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Upload, Users, XCircle } from 'lucide-react';

interface ContactSource {
  name: string;
  file?: string;
  count: number;
  lastModified?: string | null;
  /** Legacy field some clients used before sources landed. */
  updatedAt?: string;
}

interface SyncStatus {
  sources?: ContactSource[];
  /** Legacy shape; prefer sources. */
  files?: ContactSource[];
  totalContacts?: number;
  configured?: boolean;
}

interface SyncResult {
  imported?: number;
  skipped?: number;
  error?: string;
  source?: string;
  ok?: boolean;
}

function normalizeStatus(raw: SyncStatus): {
  sources: ContactSource[];
  totalContacts: number;
  configured: boolean;
} {
  const sources = Array.isArray(raw.sources)
    ? raw.sources
    : Array.isArray(raw.files)
      ? raw.files
      : [];
  const totalFromSources = sources.reduce((sum, s) => sum + (Number(s.count) || 0), 0);
  return {
    sources,
    totalContacts: typeof raw.totalContacts === 'number' ? raw.totalContacts : totalFromSources,
    configured: Boolean(raw.configured),
  };
}

export default function ContactsSettingsPage() {
  const [status, setStatus] = useState<ReturnType<typeof normalizeStatus> | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function loadStatus() {
    setLoading(true);
    try {
      const res = await fetch('/api/contacts-sync');
      if (res.ok) {
        const data = (await res.json()) as SyncStatus;
        setStatus(normalizeStatus(data));
      } else {
        setStatus(null);
      }
    } catch {
      setStatus(null);
    }
    setLoading(false);
  }

  useEffect(() => {
    void loadStatus();
  }, []);

  async function handleGoogleSync() {
    setSyncing(true);
    setResult(null);
    try {
      const res = await fetch('/api/contacts-sync?action=google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const data = (await res.json()) as SyncResult & { errors?: string[] };
      if (!res.ok) {
        setResult({
          error:
            data.error
            ?? (Array.isArray(data.errors) ? data.errors[0] : undefined)
            ?? 'Google sync failed',
        });
      } else if (Array.isArray(data.errors) && data.errors.length > 0 && !data.imported) {
        setResult({ error: data.errors[0] });
      } else {
        setResult(data);
        if (!data.error) await loadStatus();
      }
    } catch (e) {
      setResult({ error: e instanceof Error ? e.message : 'Request failed' });
    }
    setSyncing(false);
  }

  async function handleCsvUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSyncing(true);
    setResult(null);
    const text = await file.text();
    try {
      const res = await fetch('/api/contacts-sync?action=csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvContent: text, filename: file.name }),
      });
      const data = (await res.json()) as SyncResult;
      if (!res.ok && !data.error) {
        setResult({ error: 'CSV import failed' });
      } else {
        setResult(data);
      }
      if (res.ok && !data.error) await loadStatus();
    } catch (err) {
      setResult({ error: err instanceof Error ? err.message : 'Upload failed' });
    }
    setSyncing(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  const sources = status?.sources ?? [];

  return (
    <div className="mx-auto max-w-[90rem] px-6 py-8">
      <Link
        href="/settings?section=join"
        className="mb-4 inline-flex items-center gap-1 text-xs text-text-muted hover:text-text-primary"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to settings
      </Link>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-text-secondary" />
          <h1 className="text-lg font-semibold text-text-primary">Contacts import</h1>
        </div>
        <Link
          href="/contacts"
          className="inline-flex items-center rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-elevated hover:text-text-primary"
        >
          Open Contacts directory
        </Link>
      </div>
      <p className="mb-6 text-xs text-text-muted">
        Import contacts from Google or a CSV file. Browse, edit, and delete them in the{' '}
        <Link href="/contacts" className="underline underline-offset-2">
          Contacts directory
        </Link>
        . Your Aivas can then list, search, and reach out using the contacts tool.
      </p>

      <div className="space-y-4">
        <div className="rounded-lg border border-border bg-surface p-5">
          <h2 className="mb-1 text-sm font-medium text-text-primary">Google Contacts</h2>
          <p className="mb-4 text-xs text-text-muted">
            Sync all contacts from your connected Google account. Choose{' '}
            <strong className="font-medium text-text-secondary">Google Contacts</strong> under Tools,
            connect with Google, then sync here.
          </p>
          {status?.configured === false ? (
            <div className="mb-4 rounded-md border border-amber-200/80 bg-amber-50 px-3 py-2.5 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
              Google Contacts is not connected for this workspace yet.{' '}
              <Link
                href="/aiva/tools?tool=google-contacts"
                className="font-medium underline underline-offset-2 hover:opacity-90"
              >
                Open Tools and select Google Contacts
              </Link>
              , then come back and sync.
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void handleGoogleSync()}
              disabled={syncing}
              className="btn-primary rounded-md px-4 py-2 text-xs font-medium disabled:opacity-50"
            >
              {syncing ? 'Syncing...' : 'Sync from Google'}
            </button>
            <Link
              href="/aiva/tools?tool=google-contacts"
              className="inline-flex items-center rounded-md border border-border px-4 py-2 text-xs font-medium text-text-secondary hover:bg-elevated hover:text-text-primary"
            >
              {status?.configured === false
                ? 'Set up Google Contacts in Tools'
                : 'Manage Google Contacts in Tools'}
            </Link>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-5">
          <h2 className="mb-1 text-sm font-medium text-text-primary">Import CSV</h2>
          <p className="mb-4 text-xs text-text-muted">
            Upload a CSV file with columns: name, email, phone, whatsapp, telegram, company, notes,
            tags. Column names are flexible.
          </p>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-4 py-2 text-xs font-medium text-text-secondary hover:bg-elevated">
            <Upload className="h-3.5 w-3.5" />
            Choose CSV file
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => void handleCsvUpload(e)}
            />
          </label>
        </div>
      </div>

      {result && (
        <div
          className={`mt-4 flex items-start gap-2 rounded-md border px-4 py-3 text-xs ${
            result.error
              ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400'
              : 'border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-400'
          }`}
        >
          {result.error ? (
            <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          ) : (
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          )}
          <span>
            {result.error
              ? result.error
              : `Imported ${result.imported ?? 0} contacts${result.skipped ? `, skipped ${result.skipped}` : ''}.`}
            {result.error && /Tools|reconnect|reauth|Google access expired/i.test(result.error) ? (
              <>
                {' '}
                <Link
                  href="/aiva/tools?tool=google-contacts"
                  className="font-medium underline underline-offset-2"
                >
                  Open Tools to reconnect Google Contacts
                </Link>
              </>
            ) : null}
          </span>
        </div>
      )}

      <div className="mt-8">
        <h2 className="mb-3 text-sm font-medium text-text-secondary">Synced sources</h2>
        {loading ? (
          <p className="text-xs text-text-muted">Loading...</p>
        ) : sources.length === 0 ? (
          <p className="text-xs text-text-muted">No contacts imported yet.</p>
        ) : (
          <div className="space-y-2">
            {sources.map((f) => {
              const stamp = f.lastModified ?? f.updatedAt;
              return (
                <div
                  key={f.file ?? f.name}
                  className="flex items-center justify-between rounded-md border border-border bg-surface px-4 py-2.5 text-xs"
                >
                  <span className="font-medium text-text-primary">{f.name}</span>
                  <div className="flex items-center gap-4 text-text-muted">
                    <span>{f.count} contacts</span>
                    <span>{stamp ? new Date(stamp).toLocaleDateString() : 'n/a'}</span>
                  </div>
                </div>
              );
            })}
            <p className="pt-1 text-xs text-text-muted">
              Total: {status?.totalContacts ?? 0} contacts across {sources.length} source
              {sources.length !== 1 ? 's' : ''}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
