'use client';

import { FormEvent, useState } from 'react';
import { AgentOsShell } from '@/components/agent-os/AgentOsShell';
import { Button } from '@/components/ui/button';

export default function CrmImportPage() {
  const [csv, setCsv] = useState('name,email\nAda Lovelace,ada@example.com\nAda Lovelace,ada@example.com\n');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState<string | null>(null);
  const [download, setDownload] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setSummary(null);
    setDownload(null);
    try {
      const res = await fetch('/api/agent-os/workflows/crm-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Clean failed');
      setSummary(JSON.stringify(data.summary, null, 2));
      setDownload(typeof data.csv === 'string' ? data.csv : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Clean failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AgentOsShell
      title="CRM Import / Clean"
      description="Upload CSV, dedupe, normalize. Carina contacts first; no invented HubSpot connector."
    >
      <form onSubmit={submit} className="mx-auto max-w-2xl space-y-3">
        <textarea
          className="min-h-48 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm"
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
        />
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        {summary ? <pre className="rounded-xl border border-border p-3 text-xs">{summary}</pre> : null}
        {download ? (
          <a
            className="inline-flex min-h-11 items-center text-sm text-accent hover:underline"
            href={`data:text/csv;charset=utf-8,${encodeURIComponent(download)}`}
            download="cleaned-contacts.csv"
          >
            Download cleaned CSV
          </a>
        ) : null}
        <Button type="submit" className="min-h-11" disabled={busy}>
          {busy ? 'Cleaning…' : 'Clean CSV'}
        </Button>
      </form>
    </AgentOsShell>
  );
}
