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

const ERROR_MESSAGES: Record<string, string> = {
  denied: 'You cancelled the connection on Propreneur.',
  missing_code: 'Connection link was incomplete. Please try again.',
  invalid_state: 'Connection link expired or was invalid. Please try again.',
  state_mismatch: 'Connection was started for a different workspace. Please try again.',
  exchange_failed: 'Could not finish authorization with Propreneur. Please try again.',
  incomplete_grant: 'Propreneur did not return a complete connection. Please try again.',
  bind_failed: 'Authorization succeeded but binding failed. Please try again or use a key.',
  not_configured: 'One-click connect is not configured on this Aiva host.',
  server_error: 'Something went wrong during connection. Please try again.',
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
  const [showManual, setShowManual] = useState(false);

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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ok = params.get('propreneur_ok');
    const err = params.get('propreneur_error');
    const slug = params.get('propreneur_slug');
    const props = params.get('propreneur_props');

    if (ok === '1') {
      const count = props != null ? Number(props) : null;
      setSuccess(
        count != null && !Number.isNaN(count)
          ? `Connected to ${slug ?? 'your Propreneur workspace'}. Portfolio: ${count} propert${count === 1 ? 'y' : 'ies'}.`
          : `Connected to ${slug ?? 'your Propreneur workspace'}.`,
      );
      if (count != null && !Number.isNaN(count)) setPropertyCount(count);
      void loadStatus();
    } else if (err) {
      setError(ERROR_MESSAGES[err] ?? `Connection failed (${err}).`);
    }

    if (ok || err) {
      const next = new URL(window.location.href);
      next.searchParams.delete('propreneur_ok');
      next.searchParams.delete('propreneur_error');
      next.searchParams.delete('propreneur_slug');
      next.searchParams.delete('propreneur_props');
      window.history.replaceState({}, '', next.pathname + next.search);
    }
  }, [loadStatus]);

  function handleOneClick(e: React.FormEvent) {
    e.preventDefault();
    const slug = tenantSlug.trim().toLowerCase();
    if (!slug) {
      setError('Enter your Propreneur workspace name first.');
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    window.location.href = `/api/aiva/workers/${encodeURIComponent(workerId)}/propreneur/oauth/start?tenantSlug=${encodeURIComponent(slug)}`;
  }

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
          <h4 className="text-sm font-medium text-text-primary">Propreneur workspace</h4>
          <p className="mt-1 max-w-xl text-xs text-text-muted">
            Link this Aiva to your Propreneur tenant for portfolio briefings and managed actions.
            Prefer one-click connect: enter your workspace name, then Allow on Propreneur.
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

      <form onSubmit={handleOneClick} className="max-w-lg space-y-3">
        <div>
          <label className="text-xs font-medium text-text-primary">Propreneur workspace name</label>
          <input
            required
            value={tenantSlug}
            onChange={(e) => setTenantSlug(e.target.value)}
            placeholder="e.g. xelox"
            className={`mt-1 ${AIVA_INPUT_CLASS}`}
          />
          <p className="mt-1 text-[11px] text-text-muted">
            From your address: <span className="font-mono">name</span>.propreneur.uk
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={submitting} className="btn-primary text-xs">
            {submitting ? 'Opening Propreneur...' : status?.bound ? 'Reconnect with one click' : 'Connect Propreneur'}
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
          <button
            type="button"
            className="btn-ghost text-xs"
            onClick={() => setShowManual((v) => !v)}
          >
            {showManual ? 'Hide manual key' : 'Paste key instead'}
          </button>
        </div>
      </form>

      {showManual ? (
        <form onSubmit={(e) => void handleBind(e)} className="mt-4 max-w-lg space-y-3 border-t border-border pt-4">
          <p className="text-[11px] text-text-muted">
            Fallback: generate a key at{' '}
            <span className="font-mono">
              https://{tenantSlug || 'your-slug'}.propreneur.uk/aiva/connect
            </span>{' '}
            and paste it below.
          </p>
          <div>
            <label className="text-xs font-medium text-text-primary">Carina Remote API key</label>
            <input
              required
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="crm_..."
              className={`mt-1 ${AIVA_INPUT_CLASS}`}
            />
          </div>
          <button type="submit" disabled={submitting} className="btn-primary text-xs">
            {submitting ? 'Binding...' : 'Bind with key'}
          </button>
        </form>
      ) : null}

      {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
      {success ? <p className="mt-2 text-xs text-green-400">{success}</p> : null}
      {propertyCount != null && !success ? (
        <p className="mt-2 text-xs text-text-muted">Portfolio properties visible: {propertyCount}</p>
      ) : null}
    </div>
  );
}
