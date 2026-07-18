'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AIVA_INPUT_CLASS } from '@/lib/aiva-utils';

type AssistRequest = {
  id: string;
  reason: string;
  urgency: string;
  status: string;
  createdAt: string;
};

export default function AivaHumanAssistPage() {
  const [requests, setRequests] = useState<AssistRequest[]>([]);
  const [reason, setReason] = useState('');
  const [urgency, setUrgency] = useState<'normal' | 'urgent'>('normal');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load() {
    const res = await fetch('/api/aiva/human-assist/requests');
    const data = (await res.json()) as { requests?: AssistRequest[]; error?: string };
    if (!res.ok) {
      setError(data.error ?? 'Could not load requests');
      return;
    }
    setRequests(data.requests ?? []);
    setError('');
  }

  useEffect(() => {
    void load();
  }, []);

  async function submit() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await fetch('/api/aiva/human-assist/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, urgency }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        code?: string;
        request?: AssistRequest;
      };
      if (!res.ok || data.ok === false) {
        setError(data.error ?? 'Request failed');
        if (data.request) await load();
        return;
      }
      setNotice('Request queued. A human may pick it up subject to availability and fair use. No extra fee by default.');
      setReason('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Request human assist</h1>
        <p className="mt-1 text-sm text-text-muted">
          Aiva is your AI employee. Human help is optional: requests enter a queue. Fulfilment depends on
          urgency, VA availability, and monthly fair use. Default fee is £0.
        </p>
        <p className="mt-2 text-sm">
          <Link href="/aiva/approvals" className="text-accent hover:underline">Back to Inbox</Link>
          {' · '}
          <Link href="/aiva/org" className="text-accent hover:underline">Org</Link>
          {' · '}
          <Link href="/workspace-ops" className="text-accent hover:underline">Drive ops</Link>
        </p>
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {notice ? <p className="text-sm text-emerald-700 dark:text-emerald-300">{notice}</p> : null}

      <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
        <label className="block text-sm">
          <span className="mb-1 block text-text-muted">What do you need?</span>
          <textarea
            className={`${AIVA_INPUT_CLASS} min-h-28`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Briefly describe the task a human should review"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-text-muted">Urgency</span>
          <select
            className={AIVA_INPUT_CLASS}
            value={urgency}
            onChange={(e) => setUrgency(e.target.value as 'normal' | 'urgent')}
          >
            <option value="normal">Normal (queue)</option>
            <option value="urgent">Urgent (still subject to availability)</option>
          </select>
        </label>
        <button
          type="button"
          disabled={busy || !reason.trim()}
          onClick={() => void submit()}
          className="rounded-lg border border-accent/40 bg-accent-dim px-4 py-2 text-sm font-medium text-accent"
        >
          {busy ? 'Submitting...' : 'Submit request'}
        </button>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-text-primary">Your requests</h2>
        {requests.length === 0 ? (
          <p className="text-sm text-text-muted">No requests yet.</p>
        ) : (
          <ul className="space-y-2">
            {requests.map((row) => (
              <li key={row.id} className="rounded-xl border border-border bg-card px-3 py-2 text-sm">
                <p className="font-medium text-text-primary">{row.reason}</p>
                <p className="text-xs text-text-muted">
                  {row.status} · {row.urgency} · {row.createdAt}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
