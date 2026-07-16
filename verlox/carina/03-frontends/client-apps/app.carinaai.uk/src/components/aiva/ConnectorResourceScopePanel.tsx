'use client';

import { useCallback, useEffect, useState } from 'react';

type CatalogKind = { kind: string; label: string; matchMode: string };
type CatalogConnector = { connector: string; label: string; kinds: CatalogKind[] };
type Grant = {
  id: number;
  connector: string;
  resourceKind: string;
  resourceId: string;
  label: string | null;
  actions: string[];
};

/**
 * Approve exact connector resources (channel, mailbox, board, page).
 * Broad connectors show as broad until the first grant narrows them.
 */
export function ConnectorResourceScopePanel({ workerId }: { workerId?: string }) {
  const [catalog, setCatalog] = useState<CatalogConnector[]>([]);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [modes, setModes] = useState<Record<string, string>>({});
  const [connector, setConnector] = useState('slack');
  const [kind, setKind] = useState('channels');
  const [resourceId, setResourceId] = useState('');
  const [label, setLabel] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  const load = useCallback(async () => {
    const qs = workerId ? `?workerId=${encodeURIComponent(workerId)}` : '';
    const [catRes, grantRes] = await Promise.all([
      fetch('/api/aiva/connector-scopes/catalog'),
      fetch(`/api/aiva/connector-scopes${qs}`),
    ]);
    if (catRes.ok) {
      const data = await catRes.json() as { connectors: CatalogConnector[] };
      setCatalog(data.connectors ?? []);
      if (data.connectors?.[0]) {
        setConnector(data.connectors[0].connector);
        setKind(data.connectors[0].kinds[0]?.kind ?? 'channels');
      }
    }
    if (grantRes.ok) {
      const data = await grantRes.json() as { grants: Grant[]; modes: Record<string, string> };
      setGrants(data.grants ?? []);
      setModes(data.modes ?? {});
    }
  }, [workerId]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = catalog.find((c) => c.connector === connector);
  const kinds = selected?.kinds ?? [];

  async function addGrant() {
    setPending(true);
    setError('');
    try {
      const res = await fetch('/api/aiva/connector-scopes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workerId: workerId || undefined,
          connector,
          resourceKind: kind,
          resourceId: resourceId.trim(),
          label: label.trim() || undefined,
          actions: ['read', 'write'],
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error || 'Could not save resource grant');
      }
      setResourceId('');
      setLabel('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setPending(false);
    }
  }

  async function revoke(grantId: number) {
    setPending(true);
    setError('');
    try {
      const res = await fetch(`/api/aiva/connector-scopes/${grantId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Could not revoke grant');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <h3 className="text-sm font-semibold text-text-primary">Connector resource access</h3>
      <p className="mt-1 text-xs text-text-secondary">
        Approve specific channels, mailboxes, boards, or pages. Until you add a grant, access stays
        broad for that connector.
      </p>

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        {catalog.map((c) => (
          <span
            key={c.connector}
            className={`rounded-full border px-2 py-1 ${
              modes[c.connector] === 'scoped'
                ? 'border-accent/40 text-text-primary'
                : 'border-border text-text-muted'
            }`}
          >
            {c.label}: {modes[c.connector] === 'scoped' ? 'scoped' : 'broad'}
          </span>
        ))}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <label className="text-xs text-text-muted">
          Connector
          <select
            className="mt-1 w-full rounded-lg border border-border bg-elevated px-2 py-2 text-sm text-text-primary"
            value={connector}
            onChange={(e) => {
              setConnector(e.target.value);
              const next = catalog.find((c) => c.connector === e.target.value);
              setKind(next?.kinds[0]?.kind ?? '');
            }}
          >
            {catalog.map((c) => (
              <option key={c.connector} value={c.connector}>{c.label}</option>
            ))}
          </select>
        </label>
        <label className="text-xs text-text-muted">
          Resource type
          <select
            className="mt-1 w-full rounded-lg border border-border bg-elevated px-2 py-2 text-sm text-text-primary"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            {kinds.map((k) => (
              <option key={k.kind} value={k.kind}>{k.label}</option>
            ))}
          </select>
        </label>
        <label className="text-xs text-text-muted">
          Resource ID
          <input
            className="mt-1 w-full rounded-lg border border-border bg-elevated px-2 py-2 text-sm text-text-primary"
            value={resourceId}
            onChange={(e) => setResourceId(e.target.value)}
            placeholder="e.g. C0123ABCD or board id"
          />
        </label>
        <label className="text-xs text-text-muted">
          Label (optional)
          <input
            className="mt-1 w-full rounded-lg border border-border bg-elevated px-2 py-2 text-sm text-text-primary"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Support channel"
          />
        </label>
      </div>

      <button
        type="button"
        disabled={pending || !resourceId.trim()}
        onClick={() => void addGrant()}
        className="btn-primary mt-3 rounded-lg px-3 py-2 text-xs font-medium disabled:opacity-50"
      >
        {pending ? 'Saving…' : 'Approve resource'}
      </button>

      {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}

      <ul className="mt-4 space-y-2">
        {grants.length === 0 ? (
          <li className="text-xs text-text-muted">No scoped grants yet. Connectors remain broad.</li>
        ) : (
          grants.map((g) => (
            <li
              key={g.id}
              className="flex items-center justify-between rounded-lg border border-border bg-elevated px-3 py-2 text-xs"
            >
              <span className="text-text-primary">
                {g.connector} · {g.resourceKind} · {g.label || g.resourceId}
                <span className="ml-2 text-text-muted">[{g.actions.join('|')}]</span>
              </span>
              <button
                type="button"
                disabled={pending}
                onClick={() => void revoke(g.id)}
                className="text-danger hover:underline disabled:opacity-50"
              >
                Revoke
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
