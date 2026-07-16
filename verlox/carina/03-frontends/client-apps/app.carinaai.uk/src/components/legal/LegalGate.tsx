'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { LEGAL_DOCUMENT_LABELS, type LegalDocumentType } from '@/lib/legal/constants';
import { Button } from '@/components/ui/button';

type PendingDocument = {
  type: LegalDocumentType;
  version: string;
  url: string;
};

type LegalStatus = {
  pending: PendingDocument[];
  all_current_accepted: boolean;
};

function documentLabel(type: LegalDocumentType): string {
  return LEGAL_DOCUMENT_LABELS[type] ?? type;
}

export function LegalGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<LegalStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const refreshStatus = useCallback(async () => {
    const res = await fetch('/api/legal/status');
    if (!res.ok) {
      setStatus(null);
      return;
    }
    const data = (await res.json()) as LegalStatus;
    setStatus(data);
    setChecked({});
  }, []);

  useEffect(() => {
    void fetch('/api/legal/status')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: LegalStatus | null) => setStatus(data))
      .catch(() => setStatus(null))
      .finally(() => setLoading(false));
  }, []);

  const pending = status?.pending ?? [];
  const showGate = !loading && pending.length > 0;

  const allChecked = useMemo(
    () => pending.length > 0 && pending.every((doc) => checked[`${doc.type}:${doc.version}`]),
    [pending, checked],
  );

  const reacceptanceNote = pending.length === 1
    ? `We have updated ${documentLabel(pending[0].type)}. Please review and accept the new version to continue.`
    : '';

  async function onAccept() {
    if (!pending.length || !allChecked) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/legal/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acceptances: pending.map((doc) => ({
            document_type: doc.type,
            version: doc.version,
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Could not record acceptance.');
        return;
      }
      await refreshStatus();
    } catch {
      setError('Could not record acceptance. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return children;
  if (!showGate) return children;

  return (
    <>
      {children}
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
        <div
          className="w-full max-w-lg rounded-xl border border-border bg-surface p-6 shadow-xl"
          role="dialog"
          aria-modal="true"
          aria-labelledby="legal-gate-title"
        >
          <h1 id="legal-gate-title" className="text-lg font-semibold text-text-primary">
            Before you continue
          </h1>
          <p className="mt-2 text-sm text-text-secondary">
            Please review and accept the following:
          </p>
          {reacceptanceNote ? (
            <p className="mt-2 text-sm text-amber-300">{reacceptanceNote}</p>
          ) : null}

          <ul className="mt-4 space-y-3">
            {pending.map((doc) => {
              const key = `${doc.type}:${doc.version}`;
              return (
                <li key={key} className="flex items-center justify-between gap-3 text-sm">
                  <label className="flex min-w-0 flex-1 items-center gap-2 text-text-primary">
                    <input
                      type="checkbox"
                      className="h-4 w-4 shrink-0"
                      checked={Boolean(checked[key])}
                      onChange={(event) => {
                        setChecked((prev) => ({ ...prev, [key]: event.target.checked }));
                      }}
                    />
                    <span className="truncate">
                      {documentLabel(doc.type)} (v{doc.version})
                    </span>
                  </label>
                  <Link
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-accent hover:underline"
                  >
                    Read
                  </Link>
                </li>
              );
            })}
          </ul>

          <p className="mt-4 text-xs text-text-secondary">
            By clicking Accept, you confirm that you have read and agree to these documents.
          </p>

          {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}

          <div className="mt-6 flex justify-end">
            <Button
              type="button"
              disabled={!allChecked || submitting}
              onClick={() => void onAccept()}
            >
              {submitting ? 'Saving...' : 'Accept and Continue'}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
