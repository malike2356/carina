'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { AIVA_INPUT_CLASS } from '@/lib/aiva-utils';
import { cn } from '@/lib/utils';

type Sender = {
  id: string;
  emailAddress: string;
  roleTag: string;
};

type Props = {
  workerId: string;
};

/**
 * Allowed From addresses (or @domain) the Email Handler will process.
 * Without these, the poller ignores real client mail.
 */
export function EmailSenderAllowlist({ workerId }: Props) {
  const [senders, setSenders] = useState<Sender[]>([]);
  const [emailAddress, setEmailAddress] = useState('');
  const [roleTag, setRoleTag] = useState('client');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/aiva/email/senders/${encodeURIComponent(workerId)}`);
      const data = (await res.json()) as { senders?: Sender[]; error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Could not load allowed senders');
        setSenders([]);
        return;
      }
      setSenders(data.senders ?? []);
    } catch {
      setError('Could not load allowed senders');
    } finally {
      setLoading(false);
    }
  }, [workerId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onAdd(event: FormEvent) {
    event.preventDefault();
    const value = emailAddress.trim().toLowerCase();
    if (!value.includes('@')) {
      setError('Enter an email or @domain');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/aiva/email/senders/${encodeURIComponent(workerId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailAddress: value, roleTag }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Could not add sender');
        return;
      }
      setEmailAddress('');
      await load();
    } catch {
      setError('Could not add sender');
    } finally {
      setBusy(false);
    }
  }

  async function onRemove(senderId: string) {
    if (!window.confirm('Remove this allowed sender?')) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(
        `/api/aiva/email/senders/${encodeURIComponent(workerId)}/${encodeURIComponent(senderId)}`,
        { method: 'DELETE' },
      );
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? 'Could not remove sender');
        return;
      }
      await load();
    } catch {
      setError('Could not remove sender');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-elevated p-4">
      <h3 className="text-sm font-medium text-text-primary">Allowed client senders</h3>
      <p className="mt-1 text-xs text-text-muted">
        Only mail from these addresses (or @domains) is drafted for approval. Add every address
        your clients write from.
      </p>
      {loading ? <p className="mt-3 text-xs text-text-muted">Loading...</p> : null}
      {!loading && senders.length === 0 ? (
        <p className="mt-3 text-xs text-warning">
          No senders configured. Inbound client mail will be ignored until you add at least one.
        </p>
      ) : null}
      <ul className="mt-3 space-y-2">
        {senders.map((sender) => (
          <li
            key={sender.id}
            className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2 text-sm"
          >
            <span className="text-text-primary">
              {sender.emailAddress}{' '}
              <span className="text-xs text-text-muted">({sender.roleTag})</span>
            </span>
            <button
              type="button"
              disabled={busy}
              onClick={() => void onRemove(sender.id)}
              className="text-xs text-danger hover:underline disabled:opacity-50"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={(event) => void onAdd(event)} className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          className={cn(AIVA_INPUT_CLASS, 'flex-1')}
          placeholder="client@company.com or @company.com"
          value={emailAddress}
          onChange={(event) => setEmailAddress(event.target.value)}
          disabled={busy}
        />
        <select
          className={cn(AIVA_INPUT_CLASS, 'sm:w-32')}
          value={roleTag}
          onChange={(event) => setRoleTag(event.target.value)}
          disabled={busy}
        >
          <option value="client">client</option>
          <option value="other">other</option>
        </select>
        <button
          type="submit"
          disabled={busy}
          className={cn('btn-primary min-h-11 px-4 text-sm', busy && 'opacity-70')}
        >
          Add
        </button>
      </form>
      {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
    </div>
  );
}
