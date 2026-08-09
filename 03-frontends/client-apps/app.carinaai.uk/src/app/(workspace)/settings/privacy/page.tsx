'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { reopenCookieConsent } from '@/components/CookieConsent';

export default function PrivacySettingsPage() {
  const [exporting, setExporting] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState('');

  async function exportData() {
    setExporting(true);
    setMessage('');
    try {
      const res = await fetch('/api/workspace/export', { method: 'POST' });
      if (res.status === 403) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? 'Business plan required for workspace export');
      }
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'carina-export.zip';
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage('Export downloaded.');
    } catch {
      setMessage('Could not prepare export. Try again later.');
    } finally {
      setExporting(false);
    }
  }

  async function deleteAccount() {
    if (confirm !== 'DELETE') {
      setMessage('Type DELETE to confirm.');
      return;
    }
    setDeleting(true);
    setMessage('');
    try {
      const res = await fetch('/api/workspace', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'DELETE' }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? 'Deletion failed');
      }
      window.location.href = '/login';
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Deletion failed');
      setDeleting(false);
    }
  }

  return (
    <main className="w-full min-w-0 max-w-none space-y-8 px-6 py-10">
      <div>
        <p className="text-sm text-text-muted">
          <Link href="/settings" className="text-accent underline">
            Settings
          </Link>
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Privacy settings</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Export your data, manage cookies, or delete your account.
        </p>
      </div>

      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="text-sm font-medium text-text-primary">Your data</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Download a ZIP with account details, Aivas, conversations, automations, and invoice placeholders.
        </p>
        <Button className="mt-4" onClick={exportData} disabled={exporting}>
          {exporting ? 'Preparing export...' : 'Export my data'}
        </Button>
      </section>

      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="text-sm font-medium text-text-primary">Cookie preferences</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Re-open the cookie banner to change analytics consent.
        </p>
        <Button className="mt-4" variant="outline" onClick={reopenCookieConsent}>
          Manage cookies
        </Button>
      </section>

      <section className="rounded-xl border border-danger/40 bg-surface p-6">
        <h2 className="text-sm font-medium text-danger">Delete my account</h2>
        <p className="mt-2 text-sm text-text-secondary">
          This permanently deletes your account, Aivas, conversation content, and automation schedules.
          Blockchain attestation hashes remain on the public ledger without personal data. Invoice records
          may be retained in anonymized form for 7 years.
        </p>
        <div className="mt-4 space-y-2">
          <label htmlFor="delete-confirm" className="text-sm text-text-secondary">
            Type DELETE to confirm
          </label>
          <Input id="delete-confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
        <Button className="mt-4" variant="destructive" onClick={deleteAccount} disabled={deleting}>
          {deleting ? 'Deleting...' : 'Delete everything'}
        </Button>
      </section>

      {message ? <p className="text-sm text-text-secondary">{message}</p> : null}
    </main>
  );
}
