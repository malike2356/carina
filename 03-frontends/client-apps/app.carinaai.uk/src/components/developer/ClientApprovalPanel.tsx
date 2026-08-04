'use client';

import { useCallback, useEffect, useState } from 'react';

type Approval = {
  id: number;
  tokenId: string;
  fingerprint: string;
  status: string;
  requestedScopes: string[];
  uaSummary: string | null;
  clientHint: string | null;
  ipHash: string | null;
  lastSeenAt: string;
  expiresAt: string | null;
};

type Suspension = {
  tokenId: string;
  reason: string;
  suspendedAt: string;
  suspendedUntil: string | null;
};

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Partner gateway client approvals and token suspensions.
 */
export function ClientApprovalPanel() {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [suspensions, setSuspensions] = useState<Suspension[]>([]);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<number | string | null>(null);

  const load = useCallback(async () => {
    setError('');
    const res = await fetch('/api/developer/client-approvals');
    if (!res.ok) {
      if (res.status === 403) {
        setApprovals([]);
        setSuspensions([]);
        return;
      }
      setError('Could not load client approvals.');
      return;
    }
    const data = await res.json() as { approvals?: Approval[]; suspensions?: Suspension[] };
    setApprovals(data.approvals ?? []);
    setSuspensions(data.suspensions ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(approvalId: number, decision: 'approved' | 'denied' | 'revoked') {
    setBusyId(approvalId);
    setError('');
    try {
      const res = await fetch(`/api/developer/client-approvals/${approvalId}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision,
          expiresInDays: decision === 'approved' ? 30 : undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        setError(body.error ?? 'Decision failed');
        return;
      }
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function unsuspend(tokenId: string) {
    setBusyId(tokenId);
    setError('');
    try {
      const res = await fetch(`/api/developer/tokens/${encodeURIComponent(tokenId)}/unsuspend`, {
        method: 'POST',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        setError(body.error ?? 'Unsuspend failed');
        return;
      }
      await load();
    } finally {
      setBusyId(null);
    }
  }

  const pending = approvals.filter((a) => a.status === 'pending');
  const others = approvals.filter((a) => a.status !== 'pending');

  return (
    <div className="mt-10 space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">Client approvals</h2>
        <p className="mt-1 text-sm text-text-muted">
          Unknown API clients stay pending until you allow them. Fingerprints use hashed IP and user-agent only.
        </p>
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {suspensions.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-text-primary">Suspended tokens</h3>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {suspensions.map((s) => (
              <li key={s.tokenId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-mono text-xs text-text-secondary">{s.tokenId}</p>
                  <p className="text-sm text-text-primary">{s.reason}</p>
                  <p className="text-xs text-text-muted">Since {formatWhen(s.suspendedAt)}</p>
                </div>
                <button
                  type="button"
                  disabled={busyId === s.tokenId}
                  onClick={() => void unsuspend(s.tokenId)}
                  className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-elevated disabled:opacity-50"
                >
                  Clear suspension
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="space-y-2">
        <h3 className="text-sm font-medium text-text-primary">
          Pending ({pending.length})
        </h3>
        {pending.length === 0 ? (
          <p className="text-sm text-text-muted">No clients waiting for approval.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {pending.map((a) => (
              <li key={a.id} className="space-y-2 px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-text-primary">
                      {a.uaSummary ?? 'Unknown client'}
                      {a.clientHint ? ` (${a.clientHint})` : ''}
                    </p>
                    <p className="font-mono text-xs text-text-muted">
                      fp:{a.fingerprint} · ip:{a.ipHash ?? 'n/a'} · token:{a.tokenId.slice(0, 8)}…
                    </p>
                    <p className="text-xs text-text-muted">
                      Scopes: {a.requestedScopes.join(', ') || 'none'} · Last seen {formatWhen(a.lastSeenAt)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busyId === a.id}
                      onClick={() => void decide(a.id, 'approved')}
                      className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                    >
                      Allow 30d
                    </button>
                    <button
                      type="button"
                      disabled={busyId === a.id}
                      onClick={() => void decide(a.id, 'denied')}
                      className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-elevated disabled:opacity-50"
                    >
                      Deny
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {others.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-text-primary">History</h3>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {others.slice(0, 20).map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="text-sm text-text-primary">
                    {a.uaSummary ?? 'Client'} · <span className="capitalize">{a.status}</span>
                  </p>
                  <p className="font-mono text-xs text-text-muted">
                    {a.fingerprint} · {formatWhen(a.lastSeenAt)}
                    {a.expiresAt ? ` · expires ${formatWhen(a.expiresAt)}` : ''}
                  </p>
                </div>
                {a.status === 'approved' ? (
                  <button
                    type="button"
                    disabled={busyId === a.id}
                    onClick={() => void decide(a.id, 'revoked')}
                    className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-elevated disabled:opacity-50"
                  >
                    Revoke
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
