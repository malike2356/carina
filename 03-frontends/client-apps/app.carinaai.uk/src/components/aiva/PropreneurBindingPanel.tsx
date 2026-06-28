'use client';

import { useCallback, useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { AIVA_INPUT_CLASS, readAivaError } from '@/lib/aiva-utils';

const DOCS_URL = 'https://docs.carinaai.uk/user/integrations/propreneur-bridge';

type BindingStatus = {
  bound: boolean;
  tenantSlug: string | null;
  summaryEnabled?: boolean;
};

export function PropreneurBindingPanel({ workerId }: { workerId: string }) {
  const [status, setStatus] = useState<BindingStatus | null>(null);
  const [tenantSlug, setTenantSlug] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [propertyCount, setPropertyCount] = useState<number | null>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/aiva/workers/${workerId}/propreneur/status`);
      if (res.status === 503) {
        setStatus({ bound: false, tenantSlug: null });
        return;
      }
      if (!res.ok) {
        setError(await readAivaError(res));
        return;
      }
      const data = (await res.json()) as BindingStatus;
      setStatus(data);
      if (data.tenantSlug) setTenantSlug(data.tenantSlug);
    } catch {
      setError('Could not load Propreneur binding status.');
    } finally {
      setLoading(false);
    }
  }, [workerId]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  async function handleBind(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    setPropertyCount(null);
    try {
      const res = await fetch(`/api/aiva/workers/${workerId}/propreneur/bind`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantSlug: tenantSlug.trim(), apiKey: apiKey.trim() }),
      });
      if (!res.ok) {
        setError(await readAivaError(res));
        return;
      }
      const data = (await res.json()) as { propertyCount?: number; tenantSlug?: string };
      setPropertyCount(data.propertyCount ?? null);
      setSuccess(
        data.propertyCount != null
          ? `Bound to ${data.tenantSlug ?? tenantSlug}. Portfolio smoke test: ${data.propertyCount} propert${data.propertyCount === 1 ? 'y' : 'ies'}.`
          : 'Propreneur workspace bound.',
      );
      setApiKey('');
      await loadStatus();
    } catch {
      setError('Bind request failed.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUnbind() {
    if (!window.confirm('Remove Propreneur binding? Bridge reads and daily summaries sourced from Propreneur will stop.')) {
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/aiva/workers/${workerId}/propreneur/bind`, { method: 'DELETE' });
      if (!res.ok) {
        setError(await readAivaError(res));
        return;
      }
      setSuccess('Propreneur binding removed.');
      setPropertyCount(null);
      setApiKey('');
      await loadStatus();
    } catch {
      setError('Could not remove binding.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <p className="text-xs text-text-muted">Loading Propreneur binding...</p>;
  }

  return (
    <div className="rounded-lg border border-border bg-elevated p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="text-sm font-medium text-text-primary">Propreneur workspace (read-only)</h4>
          <p className="mt-1 max-w-xl text-xs text-text-muted">
            Link this Aiva to a Propreneur tenant for portfolio briefings and Q&A. With bridge writes enabled,
            propose deals and payments here; your team approves under Propreneur Settings &gt; Aiva bridge review.
            Generate the API key under Propreneur Settings &gt; Carina Remote.
          </p>
        </div>
        <a
          href={DOCS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-1 text-xs text-accent hover:underline"
        >
          Bridge docs <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {status?.bound ? (
        <div className="mb-4 rounded-md border border-accent/30 bg-accent-dim/30 px-3 py-2 text-xs text-text-secondary">
          Bound to tenant slug <span className="font-mono text-text-primary">{status.tenantSlug}</span>
          {status.summaryEnabled ? (
            <span className="text-text-muted"> · daily summary enabled</span>
          ) : null}
        </div>
      ) : null}

      <form onSubmit={(e) => void handleBind(e)} className="max-w-lg space-y-3">
        <div>
          <label className="text-xs font-medium text-text-primary">Propreneur tenant slug</label>
          <input
            required
            value={tenantSlug}
            onChange={(e) => setTenantSlug(e.target.value)}
            placeholder="e.g. xelox"
            className={`mt-1 ${AIVA_INPUT_CLASS}`}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-text-primary">Carina Remote API key</label>
          <input
            required={!status?.bound}
            type="password"
            autoComplete="off"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={status?.bound ? 'Enter new key to re-bind' : 'crm_... (shown once in Propreneur)'}
            className={`mt-1 ${AIVA_INPUT_CLASS}`}
          />
        </div>
        <p className="text-[11px] text-text-muted">
          Do not connect the same IMAP mailbox in Carina if Propreneur already ingests that inbox.
          Write proposals require tenant flags <code className="text-[11px]">aiva_bridge_writes</code> and admin approval.
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={submitting} className="btn-primary text-xs">
            {submitting ? 'Binding...' : status?.bound ? 'Update binding' : 'Bind workspace'}
          </button>
          {status?.bound ? (
            <button
              type="button"
              disabled={submitting}
              onClick={() => void handleUnbind()}
              className="btn-ghost text-xs text-danger"
            >
              Remove binding
            </button>
          ) : null}
        </div>
      </form>

      {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
      {success ? <p className="mt-2 text-xs text-green-400">{success}</p> : null}
      {propertyCount != null && !success ? (
        <p className="mt-2 text-xs text-text-muted">Portfolio properties visible: {propertyCount}</p>
      ) : null}
    </div>
  );
}
