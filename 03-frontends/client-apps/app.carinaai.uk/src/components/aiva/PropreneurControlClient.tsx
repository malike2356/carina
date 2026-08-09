'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { PropreneurTenantContextBadge } from '@/components/aiva/PropreneurTenantContextBadge';

type SyncHealth = {
  ok?: boolean;
  last_event?: string | null;
  last_received_at?: string | null;
  lag_seconds?: number | null;
  retries?: number;
  pending?: number;
  dead_letter_count?: number;
  schema_version?: string | null;
  error?: string;
};

type SessionTenant = {
  ok?: boolean;
  selected_tenant_slug?: string | null;
  selected_label?: string | null;
  selected_tenant_id?: string | null;
  tenants?: Array<{ tenantId: string; tenantSlug: string; label?: string }>;
  error?: string;
};

export function PropreneurControlClient() {
  const [sync, setSync] = useState<SyncHealth | null>(null);
  const [session, setSession] = useState<SessionTenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resyncMsg, setResyncMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [syncRes, sessionRes] = await Promise.all([
        fetch('/api/aiva/propreneur/sync-health'),
        fetch('/api/aiva/propreneur/session-tenant', {
          headers: { 'x-aiva-session-id': 'workspace-ui' },
        }),
      ]);
      const syncJson = (await syncRes.json().catch(() => ({}))) as SyncHealth;
      const sessionJson = (await sessionRes.json().catch(() => ({}))) as SessionTenant;
      if (!syncRes.ok) {
        setSync({ ok: false, error: syncJson.error ?? `HTTP ${syncRes.status}` });
      } else {
        setSync(syncJson);
      }
      if (!sessionRes.ok) {
        setSession({ ok: false, error: sessionJson.error ?? `HTTP ${sessionRes.status}` });
      } else {
        setSession(sessionJson);
      }
    } catch {
      setError('Could not load Propreneur control data. Check core proxy configuration.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function selectTenant(tenantId: string) {
    setResyncMsg(null);
    const res = await fetch('/api/aiva/propreneur/session-tenant', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-aiva-session-id': 'workspace-ui',
      },
      body: JSON.stringify({ selected_tenant_id: tenantId }),
    });
    const json = (await res.json().catch(() => ({}))) as SessionTenant;
    if (!res.ok) {
      setError(json.error ?? 'Tenant selection failed');
      return;
    }
    setSession(json);
  }

  async function replayLast() {
    const eventId = sync?.last_event;
    if (!eventId) {
      setResyncMsg('No last event id available to replay.');
      return;
    }
    const res = await fetch(`/api/aiva/propreneur/replay/${encodeURIComponent(eventId)}`, {
      method: 'POST',
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string; ok?: boolean };
    setResyncMsg(
      res.ok
        ? 'Replay requested for the latest event.'
        : json.error ?? `Replay failed (HTTP ${res.status})`,
    );
    void load();
  }

  const disconnected = !session?.selected_tenant_id && (session?.tenants?.length ?? 0) === 0;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-text-primary">Propreneur control</h1>
          <PropreneurTenantContextBadge
            slug={session?.selected_tenant_slug ?? null}
            label={session?.selected_label ?? null}
            loading={loading}
          />
        </div>
        <p className="text-sm text-text-secondary">
          Tenant context, sync health, and links into Propreneur connection and approval surfaces.
        </p>
      </header>

      {error ? (
        <p className="rounded-xl border border-border bg-elevated px-4 py-3 text-sm text-rose-400" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-text-muted" role="status">
          Loading Propreneur control…
        </p>
      ) : null}

      {disconnected && !loading ? (
        <section className="rounded-xl border border-border bg-elevated px-4 py-5" aria-labelledby="disconnected-heading">
          <h2 id="disconnected-heading" className="text-sm font-semibold text-text-primary">
            Disconnected
          </h2>
          <p className="mt-2 text-sm text-text-secondary">
            No Propreneur tenant is selected for this session. Bind a worker under AI Employees, then select a tenant here.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/aiva/workers" className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-overlay">
              Open AI Employees
            </Link>
            <Link href="/aiva/approvals?tab=propreneur" className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-overlay">
              Approvals
            </Link>
          </div>
        </section>
      ) : null}

      <section className="rounded-xl border border-border bg-elevated px-4 py-5" aria-labelledby="tenant-heading">
        <h2 id="tenant-heading" className="text-sm font-semibold text-text-primary">
          Tenant selector
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          Every Propreneur answer and action should use this selected workspace.
        </p>
        {(session?.tenants?.length ?? 0) === 0 ? (
          <p className="mt-3 text-sm text-text-muted" role="status">
            No linked tenants in session memory yet. Complete worker binding first.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {(session?.tenants ?? []).map((t) => {
              const active = t.tenantId === session?.selected_tenant_id;
              return (
                <li key={t.tenantId} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm text-text-primary">
                    {t.label ?? t.tenantSlug}
                    <span className="ml-2 text-xs text-text-muted">{t.tenantSlug}</span>
                  </span>
                  <button
                    type="button"
                    className="min-h-11 rounded-lg border border-border px-3 text-sm hover:bg-overlay focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                    aria-pressed={active}
                    onClick={() => void selectTenant(t.tenantId)}
                  >
                    {active ? 'Selected' : 'Select'}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-border bg-elevated px-4 py-5" aria-labelledby="sync-heading">
        <h2 id="sync-heading" className="text-sm font-semibold text-text-primary">
          Sync operations
        </h2>
        {sync?.error ? (
          <p className="mt-2 text-sm text-text-muted" role="status">
            Sync health unavailable: {sync.error}. Configure core proxy, or open Propreneur Settings → Aiva control → Sync.
          </p>
        ) : (
          <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
            <div>
              <dt className="text-xs text-text-muted">Last event</dt>
              <dd className="text-text-primary">{sync?.last_event ?? 'none'}</dd>
            </div>
            <div>
              <dt className="text-xs text-text-muted">Lag (seconds)</dt>
              <dd className="text-text-primary">{sync?.lag_seconds ?? 'n/a'}</dd>
            </div>
            <div>
              <dt className="text-xs text-text-muted">Pending</dt>
              <dd className="text-text-primary">{sync?.pending ?? 0}</dd>
            </div>
            <div>
              <dt className="text-xs text-text-muted">Dead letters</dt>
              <dd className="text-text-primary">{sync?.dead_letter_count ?? 0}</dd>
            </div>
            <div>
              <dt className="text-xs text-text-muted">Retries</dt>
              <dd className="text-text-primary">{sync?.retries ?? 0}</dd>
            </div>
            <div>
              <dt className="text-xs text-text-muted">Schema</dt>
              <dd className="text-text-primary">{sync?.schema_version ?? '-'}</dd>
            </div>
          </dl>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="min-h-11 rounded-lg border border-border px-3 text-sm hover:bg-overlay focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            onClick={() => void load()}
          >
            Refresh
          </button>
          <button
            type="button"
            className="min-h-11 rounded-lg border border-border px-3 text-sm hover:bg-overlay focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            onClick={() => void replayLast()}
          >
            Replay last event
          </button>
        </div>
        {resyncMsg ? (
          <p className="mt-2 text-sm text-text-secondary" role="status">
            {resyncMsg}
          </p>
        ) : null}
      </section>

      <section className="rounded-xl border border-border bg-elevated px-4 py-5" aria-labelledby="links-heading">
        <h2 id="links-heading" className="text-sm font-semibold text-text-primary">
          Propreneur operator links
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          Connection, permission matrix, activity, and approvals live in the tenant app under Settings → AI → Aiva control.
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-text-secondary">
          <li>Connection and revoke: Settings → Aiva control</li>
          <li>Approval inbox: Settings → Aiva bridge review (also Approvals → Propreneur tab)</li>
          <li>Sync DLQ re-queue: Settings → Aiva control → Sync</li>
        </ul>
      </section>
    </div>
  );
}
