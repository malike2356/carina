'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AIVA_INPUT_CLASS } from '@/lib/aiva-utils';
import { cn } from '@/lib/utils';

type ProductTool = {
  slug: string;
  label: string;
  auth?: string;
  status?: string;
  category?: string;
  oauthProvider?: string;
  configFields?: string[];
};

type ToolAccount = {
  id: string;
  toolSlug: string;
  label: string;
  status: string;
  lastProbeOk: boolean | null;
};

type WorkerRow = { id: string; name: string };

export default function AivaToolAccountsPage() {
  const searchParams = useSearchParams();
  const [tools, setTools] = useState<ProductTool[]>([]);
  const [accounts, setAccounts] = useState<ToolAccount[]>([]);
  const [workers, setWorkers] = useState<WorkerRow[]>([]);
  const [toolSlug, setToolSlug] = useState('hubspot');
  const [label, setLabel] = useState('');
  const [token, setToken] = useState('');
  const [meta, setMeta] = useState<Record<string, string>>({});
  const [grantWorkerId, setGrantWorkerId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [accountsEnabled, setAccountsEnabled] = useState(true);

  const selectedTool = useMemo(
    () => tools.find((tool) => tool.slug === toolSlug) ?? null,
    [tools, toolSlug],
  );

  const isGoogleOauthTool = Boolean(
    selectedTool?.auth === 'oauth'
    && (selectedTool.oauthProvider === 'google_workspace' || selectedTool.category === 'google'),
  );

  async function load() {
    try {
      const [featuresRes, catalogRes, accountsRes, workersRes] = await Promise.all([
        fetch('/api/aiva/features'),
        fetch('/api/aiva/tools/catalog'),
        fetch('/api/aiva/tool-accounts'),
        fetch('/api/aiva/workers'),
      ]);
      const featuresData = (await featuresRes.json()) as {
        features?: { tools?: { accountsEnabled?: boolean } };
      };
      setAccountsEnabled(featuresData.features?.tools?.accountsEnabled !== false);

      const catalogData = (await catalogRes.json()) as { tools?: ProductTool[] };
      const liveTools = (catalogData.tools ?? []).filter((tool) => tool.status !== 'coming_soon');
      setTools(liveTools);
      if (liveTools.length > 0 && !liveTools.some((tool) => tool.slug === toolSlug)) {
        setToolSlug(liveTools[0]!.slug);
      }

      const accountsData = (await accountsRes.json()) as { accounts?: ToolAccount[]; error?: string };
      if (!accountsRes.ok) {
        setError(accountsData.error ?? 'Could not load accounts');
      } else {
        setAccounts(accountsData.accounts ?? []);
      }

      const workersData = (await workersRes.json()) as { workers?: WorkerRow[] };
      const nextWorkers = workersData.workers ?? [];
      setWorkers(nextWorkers);
      setGrantWorkerId((current) => {
        if (current && nextWorkers.some((worker) => worker.id === current)) return current;
        return nextWorkers[0]?.id ?? '';
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load tool accounts');
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
  }, []);

  useEffect(() => {
    const ok = searchParams.get('tools_oauth_ok');
    const fail = searchParams.get('tools_oauth_error');
    if (ok) {
      setNotice(`Google connected (${ok}). Use Grant below to attach it to an Aiva.`);
      setError('');
      void load();
    } else if (fail) {
      setError(`Google connect failed: ${fail}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- react to oauth return params
  }, [searchParams]);

  async function connectGoogleAccount() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const qs = new URLSearchParams({
        mode: 'account',
        toolSlug: selectedTool?.slug || 'google-drive',
        returnPath: '/aiva/tools',
        redirectUri: `${window.location.origin}/api/aiva/tools/oauth/google/callback`,
      });
      const res = await fetch(`/api/aiva/tools/oauth/google/auth-url?${qs.toString()}`);
      const data = (await res.json()) as { authUrl?: string; error?: string };
      if (!res.ok || !data.authUrl) {
        throw new Error(data.error ?? 'Could not start Google OAuth');
      }
      window.location.href = data.authUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google connect failed');
      setBusy(false);
    }
  }

  async function createAccount() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const credentials: Record<string, string> = {};
      if (token.trim()) credentials.value = token.trim();
      if (token.trim() && selectedTool?.auth === 'vault') credentials.token = token.trim();
      const res = await fetch('/api/aiva/tool-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolSlug,
          label: label.trim() || selectedTool?.label || toolSlug,
          credentials,
          meta,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; account?: ToolAccount };
      if (!res.ok || data.ok === false) {
        setError(data.error ?? 'Create/probe failed');
        await load();
        return;
      }
      setNotice(`Account ${data.account?.label ?? toolSlug} connected.`);
      setToken('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  }

  async function grant(accountId: string) {
    const workerId = grantWorkerId || workers[0]?.id || '';
    if (!workerId) {
      setError('Select an Aiva worker to grant. Hire an Aiva first if the list is empty.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await fetch(`/api/aiva/tool-accounts/${encodeURIComponent(accountId)}/grant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workerId }),
      });
      const data = (await res.json()) as { error?: string; grants?: unknown[] };
      if (!res.ok) {
        setError(data.error ?? 'Grant failed');
        return;
      }
      const workerName = workers.find((worker) => worker.id === workerId)?.name ?? 'worker';
      setNotice(
        `Granted to ${workerName}. Open that Aiva and refresh if Drive or tools still show disconnected.`,
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Grant failed');
    } finally {
      setBusy(false);
    }
  }

  async function removeAccount(accountId: string) {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/aiva/tool-accounts/${encodeURIComponent(accountId)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? 'Delete failed');
        return;
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Tool accounts</h1>
        <p className="mt-1 text-sm text-text-muted">
          Connect once at workspace level, then grant the same account to any worker. Channel adapters
          remain under{' '}
          <Link href="/settings/channels" className="text-accent underline-offset-2 hover:underline">
            Channels
          </Link>
          .
        </p>
      </div>

      {!accountsEnabled ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm">
          Tool accounts are disabled in depth-features (`tools.accountsEnabled`). Per-worker connect
          still works on each worker Tools tab.
        </p>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-300">
          {notice}
        </p>
      ) : null}

      <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
        <h2 className="text-base font-semibold text-text-primary">Add account</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block text-text-muted">Tool</span>
            <select
              className={AIVA_INPUT_CLASS}
              value={toolSlug}
              onChange={(e) => setToolSlug(e.target.value)}
            >
              {tools.map((tool) => (
                <option key={tool.slug} value={tool.slug}>
                  {tool.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-text-muted">Label</span>
            <input
              className={AIVA_INPUT_CLASS}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={selectedTool?.label ?? 'Account label'}
            />
          </label>
        </div>
        {isGoogleOauthTool ? (
          <div className="space-y-2">
            <p className="text-sm text-text-muted">
              Connect Google once here, then use Grant below for each Aiva. Connecting on a single Aiva
              also stores a reusable workspace account.
            </p>
            <button
              type="button"
              disabled={busy || !accountsEnabled}
              onClick={() => void connectGoogleAccount()}
              className="rounded-lg border border-accent/40 bg-accent-dim px-4 py-2 text-sm font-medium text-accent"
            >
              {busy ? 'Working...' : 'Connect with Google'}
            </button>
          </div>
        ) : selectedTool?.auth === 'vault' || selectedTool?.auth === 'api_key' ? (
          <label className="block text-sm">
            <span className="mb-1 block text-text-muted">API token / secret</span>
            <input
              type="password"
              className={AIVA_INPUT_CLASS}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              autoComplete="off"
            />
          </label>
        ) : (
          <p className="text-sm text-text-muted">
            This tool uses per-worker connect on the Aiva Tools tab, or paste credentials when fields
            appear.
          </p>
        )}
        {(selectedTool?.configFields ?? []).map((field) => (
          <label key={field} className="block text-sm">
            <span className="mb-1 block text-text-muted">{field}</span>
            <input
              className={AIVA_INPUT_CLASS}
              value={meta[field] ?? ''}
              onChange={(e) => setMeta((prev) => ({ ...prev, [field]: e.target.value }))}
            />
          </label>
        ))}
        {!isGoogleOauthTool ? (
          <button
            type="button"
            disabled={busy || !accountsEnabled}
            onClick={() => void createAccount()}
            className="rounded-lg border border-accent/40 bg-accent-dim px-4 py-2 text-sm font-medium text-accent"
          >
            {busy ? 'Working...' : 'Create + probe'}
          </button>
        ) : null}
      </section>

      <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-base font-semibold text-text-primary">Connected accounts</h2>
          <label className="text-sm">
            <span className="mb-1 block text-text-muted">Grant to worker</span>
            <select
              className={AIVA_INPUT_CLASS}
              value={grantWorkerId}
              onChange={(e) => setGrantWorkerId(e.target.value)}
              disabled={workers.length === 0}
            >
              {workers.length === 0 ? (
                <option value="">No Aivas available</option>
              ) : (
                workers.map((worker) => (
                  <option key={worker.id} value={worker.id}>
                    {worker.name}
                  </option>
                ))
              )}
            </select>
          </label>
        </div>
        {workers.length === 0 ? (
          <p className="text-sm text-amber-700 dark:text-amber-300">
            No Aivas in this org to grant to. Open the org switcher or hire an Aiva first.
          </p>
        ) : null}
        {accounts.length === 0 ? (
          <p className="text-sm text-text-muted">
            No reusable accounts yet. Connect with Google above, or connect Drive on one Aiva (that
            now stores a workspace account), then Grant here.
          </p>
        ) : (
          <ul className="space-y-2">
            {accounts.map((account) => {
              const canGrant = account.status === 'connected' && Boolean(grantWorkerId || workers[0]?.id);
              return (
                <li
                  key={account.id}
                  className={cn(
                    'flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2',
                    account.status === 'connected' ? 'border-accent/40 bg-accent/5' : 'border-border',
                  )}
                >
                  <div>
                    <p className="text-sm font-medium text-text-primary">{account.label}</p>
                    <p className="text-xs text-text-muted">
                      {account.toolSlug} · {account.status}
                      {account.lastProbeOk === false ? ' · last probe failed' : ''}
                    </p>
                    {account.status !== 'connected' ? (
                      <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                        Reconnect this account before granting.
                      </p>
                    ) : null}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busy || !canGrant}
                      onClick={() => void grant(account.id)}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
                      title={
                        !canGrant
                          ? account.status !== 'connected'
                            ? 'Account must be connected'
                            : 'Select an Aiva worker'
                          : 'Grant to selected Aiva'
                      }
                    >
                      {busy ? 'Working...' : 'Grant'}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void removeAccount(account.id)}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
