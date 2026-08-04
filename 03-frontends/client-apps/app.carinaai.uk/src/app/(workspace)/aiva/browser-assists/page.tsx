'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Assist = {
  id: string;
  workerId: string;
  url: string;
  status: string;
  pauseReason: string;
  createdAt: string;
};

export default function AivaBrowserAssistsPage() {
  const [assists, setAssists] = useState<Assist[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  async function load() {
    try {
      const res = await fetch('/api/aiva/browser/assists');
      const data = (await res.json()) as { assists?: Assist[]; error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Could not load assists');
        return;
      }
      setAssists(data.assists ?? []);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load assists');
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function resume(id: string) {
    setBusy(id);
    try {
      const res = await fetch(`/api/aiva/browser/assists/${encodeURIComponent(id)}/resume`, {
        method: 'POST',
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? 'Resume failed');
        return;
      }
      await load();
    } finally {
      setBusy('');
    }
  }

  async function cancel(id: string) {
    setBusy(id);
    try {
      await fetch(`/api/aiva/browser/assists/${encodeURIComponent(id)}/cancel`, { method: 'POST' });
      await load();
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="mx-auto max-w-[90rem] space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Browser assists</h1>
        <p className="mt-1 text-sm text-text-muted">
          Owner-assist pauses when hard browse hits a CAPTCHA or challenge. Resume after solving, or
          cancel. Policy is in `depth-features.browser`.
        </p>
        <p className="mt-2 text-sm">
          <Link href="/aiva/tools" className="text-accent hover:underline">
            Tool accounts
          </Link>
        </p>
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {assists.length === 0 ? (
        <p className="text-sm text-text-muted">No open assists.</p>
      ) : (
        <ul className="space-y-3">
          {assists.map((assist) => (
            <li key={assist.id} className="rounded-xl border border-border bg-card p-4">
              <p className="text-sm font-medium text-text-primary break-all">{assist.url}</p>
              <p className="mt-1 text-xs text-text-muted">
                {assist.pauseReason} · worker {assist.workerId.slice(0, 8)} · {assist.createdAt}
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={busy === assist.id}
                  onClick={() => void resume(assist.id)}
                  className="rounded-lg border border-accent/40 bg-accent-dim px-3 py-1.5 text-xs font-medium text-accent"
                >
                  Resume
                </button>
                <button
                  type="button"
                  disabled={busy === assist.id}
                  onClick={() => void cancel(assist.id)}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs"
                >
                  Cancel
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
