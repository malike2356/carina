'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Upload, Users, XCircle } from 'lucide-react';

interface SyncStatus {
  files: { name: string; count: number; updatedAt: string }[];
  totalContacts: number;
}

interface SyncResult {
  imported?: number;
  skipped?: number;
  error?: string;
  source?: string;
}

export default function ContactsSettingsPage() {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function loadStatus() {
    setLoading(true);
    try {
      const res = await fetch('/api/contacts-sync');
      if (res.ok) setStatus(await res.json());
    } catch { /* ignore */ }
    setLoading(false);
  }

  useEffect(() => { void loadStatus(); }, []);

  async function handleGoogleSync() {
    setSyncing(true);
    setResult(null);
    try {
      const res = await fetch('/api/contacts-sync?action=google', { method: 'POST' });
      const data = await res.json() as SyncResult;
      setResult(data);
      if (!data.error) await loadStatus();
    } catch (e) {
      setResult({ error: e instanceof Error ? e.message : 'Request failed' });
    }
    setSyncing(false);
  }

  async function handleCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSyncing(true);
    setResult(null);
    const text = await file.text();
    try {
      const res = await fetch('/api/contacts-sync?action=csv', {
        method: 'POST',
        headers: { 'Content-Type': 'text/csv' },
        body: JSON.stringify({ csvContent: text, filename: file.name }),
      });
      const data = await res.json() as SyncResult;
      setResult(data);
      if (!data.error) await loadStatus();
    } catch (e) {
      setResult({ error: e instanceof Error ? e.message : 'Upload failed' });
    }
    setSyncing(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <Link
        href="/settings?section=join"
        className="mb-4 inline-flex items-center gap-1 text-xs text-text-muted hover:text-text-primary"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to settings
      </Link>

      <div className="mb-6 flex items-center gap-2">
        <Users className="h-5 w-5 text-text-secondary" />
        <h1 className="text-lg font-semibold text-text-primary">Contacts</h1>
      </div>
      <p className="mb-6 text-xs text-text-muted">
        Import contacts from Google or a CSV file. Carina can then list, search, and reach out to
        them using the contacts tool.
      </p>

      <div className="space-y-4">
        <div className="rounded-lg border border-border bg-surface p-5">
          <h2 className="mb-1 text-sm font-medium text-text-primary">Google Contacts</h2>
          <p className="mb-4 text-xs text-text-muted">
            Sync all contacts from your connected Google account. Requires Google OAuth with contacts
            read permission.
          </p>
          <button
            onClick={() => void handleGoogleSync()}
            disabled={syncing}
            className="rounded-md bg-brand px-4 py-2 text-xs font-medium text-white hover:bg-brand/90 disabled:opacity-50"
          >
            {syncing ? 'Syncing...' : 'Sync from Google'}
          </button>
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
          </span>
        </div>
      )}

      <div className="mt-8">
        <h2 className="mb-3 text-sm font-medium text-text-secondary">Synced sources</h2>
        {loading ? (
          <p className="text-xs text-text-muted">Loading...</p>
        ) : !status || status.files.length === 0 ? (
          <p className="text-xs text-text-muted">No contacts imported yet.</p>
        ) : (
          <div className="space-y-2">
            {status.files.map((f) => (
              <div
                key={f.name}
                className="flex items-center justify-between rounded-md border border-border bg-surface px-4 py-2.5 text-xs"
              >
                <span className="font-medium text-text-primary">{f.name}</span>
                <div className="flex items-center gap-4 text-text-muted">
                  <span>{f.count} contacts</span>
                  <span>{new Date(f.updatedAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
            <p className="pt-1 text-xs text-text-muted">
              Total: {status.totalContacts} contacts across {status.files.length} source
              {status.files.length !== 1 ? 's' : ''}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
