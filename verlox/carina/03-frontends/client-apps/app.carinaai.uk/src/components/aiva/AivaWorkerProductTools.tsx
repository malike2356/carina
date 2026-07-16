'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Check, Link2, Unplug } from 'lucide-react';
import { AIVA_INPUT_CLASS } from '@/lib/aiva-utils';
import { cn } from '@/lib/utils';

type ProductTool = {
  slug: string;
  label: string;
  scopes: string[];
  category?: string;
  status?: string;
  auth?: string;
  configFields?: string[];
  oauthProvider?: string;
};

type ToolGrant = {
  id: string;
  toolSlug: string;
  scopes: string[];
  status: string;
};

type AccountGrant = {
  accountId: string;
  toolSlug: string;
  label: string;
  status: string;
};

type WorkspaceAccount = {
  id: string;
  toolSlug: string;
  label: string;
  status: string;
};

export function AivaWorkerProductTools({ workerId }: { workerId: string }) {
  const searchParams = useSearchParams();
  const [tools, setTools] = useState<ProductTool[]>([]);
  const [grants, setGrants] = useState<ToolGrant[]>([]);
  const [accountGrants, setAccountGrants] = useState<AccountGrant[]>([]);
  const [workspaceAccounts, setWorkspaceAccounts] = useState<WorkspaceAccount[]>([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [busySlug, setBusySlug] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [vaultValue, setVaultValue] = useState<Record<string, string>>({});
  const [metaFields, setMetaFields] = useState<Record<string, Record<string, string>>>({});
  const [pickAccount, setPickAccount] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    try {
      const [toolsRes, accountsRes] = await Promise.all([
        fetch(`/api/aiva/workers/${workerId}/tools`),
        fetch('/api/aiva/tool-accounts'),
      ]);
      const data = (await toolsRes.json()) as {
        tools?: ProductTool[];
        grants?: ToolGrant[];
        accountGrants?: AccountGrant[];
        error?: string;
      };
      if (!toolsRes.ok) {
        setError(data.error ?? 'Could not load tools');
        return;
      }
      setTools(data.tools ?? []);
      setGrants(data.grants ?? []);
      setAccountGrants(data.accountGrants ?? []);
      if (accountsRes.ok) {
        const accountsData = (await accountsRes.json()) as { accounts?: WorkspaceAccount[] };
        setWorkspaceAccounts(accountsData.accounts ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load tools');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [workerId]);

  useEffect(() => {
    const ok = searchParams.get('tools_oauth_ok');
    const fail = searchParams.get('tools_oauth_error');
    if (ok) {
      setNotice(`Google connected (${ok}). Probe complete where APIs allow.`);
      setError('');
      void load();
    } else if (fail) {
      setError(`Google connect failed: ${fail}`);
    }
  }, [searchParams, workerId]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const tool of tools) if (tool.category) set.add(tool.category);
    return ['all', ...Array.from(set).sort()];
  }, [tools]);

  const visible = tools.filter((tool) => filter === 'all' || tool.category === filter);
  const grantBySlug = new Map(grants.map((grant) => [grant.toolSlug, grant]));
  const accountGrantBySlug = new Map(accountGrants.map((grant) => [grant.toolSlug, grant]));

  async function startGoogleOAuth(tool: ProductTool) {
    const returnPath = `/aiva/workers/${workerId}?tab=channels`;
    const qs = new URLSearchParams({
      workerId,
      toolSlug: tool.slug,
      returnPath,
    });
    const res = await fetch(`/api/aiva/tools/oauth/google/auth-url?${qs.toString()}`);
    const data = (await res.json()) as { authUrl?: string; error?: string };
    if (!res.ok || !data.authUrl) {
      throw new Error(data.error ?? 'Could not start Google OAuth');
    }
    window.location.href = data.authUrl;
  }

  async function connect(tool: ProductTool) {
    setBusySlug(tool.slug);
    setError('');
    setNotice('');
    try {
      if (tool.auth === 'oauth' && (tool.oauthProvider === 'google_workspace' || tool.category === 'google')) {
        await startGoogleOAuth(tool);
        return;
      }

      if (tool.auth === 'vault' && !vaultValue[tool.slug]?.trim()) {
        setError(`Enter an API token / secret for ${tool.label} before Connect + probe.`);
        return;
      }

      const credentials: Record<string, string> = {};
      if (tool.auth === 'vault' && vaultValue[tool.slug]?.trim()) {
        credentials.value = vaultValue[tool.slug]!.trim();
      }
      const res = await fetch(`/api/aiva/workers/${workerId}/tools`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolSlug: tool.slug,
          scopes: tool.scopes,
          credentials: Object.keys(credentials).length ? credentials : undefined,
          meta: metaFields[tool.slug],
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        ok?: boolean;
        authUrl?: string;
        needsOAuth?: boolean;
      };
      if (data.authUrl) {
        window.location.href = data.authUrl;
        return;
      }
      if (!res.ok || data.ok === false) {
        setError(data.error ?? 'Connect/probe failed');
        await load();
        return;
      }
      setVaultValue((prev) => ({ ...prev, [tool.slug]: '' }));
      setNotice(`${tool.label} connected.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connect/probe failed');
    } finally {
      setBusySlug('');
    }
  }

  async function disconnect(slug: string) {
    setBusySlug(slug);
    setError('');
    try {
      const res = await fetch(`/api/aiva/workers/${workerId}/tools/${encodeURIComponent(slug)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? 'Could not disconnect tool');
        return;
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not disconnect tool');
    } finally {
      setBusySlug('');
    }
  }

  async function grantFromAccount(tool: ProductTool) {
    const accountId = pickAccount[tool.slug]
      ?? workspaceAccounts.find((account) => account.toolSlug === tool.slug && account.status === 'connected')?.id;
    if (!accountId) {
      setError(`No workspace account for ${tool.label}. Create one under Tools.`);
      return;
    }
    setBusySlug(tool.slug);
    setError('');
    setNotice('');
    try {
      const res = await fetch(`/api/aiva/tool-accounts/${encodeURIComponent(accountId)}/grant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workerId }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Grant failed');
        return;
      }
      setNotice(`Granted ${tool.label} from workspace account.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Grant failed');
    } finally {
      setBusySlug('');
    }
  }

  return (
    <section id="product-tools" className="space-y-3 rounded-2xl border border-border bg-card p-5">
      <div>
        <h3 className="text-base font-semibold text-text-primary">Product tools</h3>
        <p className="mt-1 text-sm text-text-muted">
          Catalog is config-driven. Prefer granting a workspace tool account (see{' '}
          <a href="/aiva/tools" className="text-accent underline-offset-2 hover:underline">Tools</a>
          ). Google tools can still open Google consent. Connected only if the probe succeeds.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => setFilter(category)}
            className={cn(
              'rounded-full px-3 py-1.5 text-xs font-medium',
              filter === category ? 'bg-primary/10 text-primary' : 'border border-border text-text-secondary',
            )}
          >
            {category}
          </button>
        ))}
      </div>
      {error ? (
        <p className="sticky top-0 z-10 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-300">
          {notice}
        </p>
      ) : null}
      {loading ? (
        <p className="text-sm text-text-muted">Loading tools...</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {visible.map((tool) => {
            const grant = grantBySlug.get(tool.slug);
            const accountGrant = accountGrantBySlug.get(tool.slug);
            const connected = grant?.status === 'connected' || accountGrant?.status === 'connected';
            const comingSoon = tool.status === 'coming_soon';
            const isGoogleOauth =
              tool.auth === 'oauth' &&
              (tool.oauthProvider === 'google_workspace' || tool.category === 'google');
            const reusable = workspaceAccounts.filter(
              (account) => account.toolSlug === tool.slug && account.status === 'connected',
            );
            return (
              <div
                key={tool.slug}
                className={cn(
                  'rounded-xl border p-4',
                  connected ? 'border-accent/40 bg-accent/5' : 'border-border bg-elevated',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-text-primary">{tool.label}</p>
                    <p className="mt-1 text-xs text-text-muted">
                      {tool.status ?? 'live'} · {tool.auth ?? 'n/a'} · {tool.scopes.join(', ')}
                      {accountGrant ? ` · account: ${accountGrant.label}` : ''}
                    </p>
                  </div>
                  {connected ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                      <Check className="h-3 w-3" />
                      On
                    </span>
                  ) : null}
                </div>
                {!connected && reusable.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    <select
                      className={AIVA_INPUT_CLASS}
                      value={pickAccount[tool.slug] ?? reusable[0]!.id}
                      onChange={(e) =>
                        setPickAccount((prev) => ({ ...prev, [tool.slug]: e.target.value }))
                      }
                    >
                      {reusable.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={busySlug === tool.slug}
                      onClick={() => void grantFromAccount(tool)}
                      className="inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-lg border border-accent/40 bg-accent-dim px-3 text-sm font-medium text-accent"
                    >
                      Grant from account
                    </button>
                  </div>
                ) : null}
                {!connected && tool.auth === 'vault' && !comingSoon ? (
                  <input
                    type="password"
                    value={vaultValue[tool.slug] ?? ''}
                    onChange={(e) => setVaultValue((prev) => ({ ...prev, [tool.slug]: e.target.value }))}
                    placeholder="API token / secret"
                    className={cn(AIVA_INPUT_CLASS, 'mt-3')}
                    autoComplete="off"
                  />
                ) : null}
                {!connected && (tool.configFields?.length ?? 0) > 0 && !comingSoon ? (
                  <div className="mt-2 space-y-2">
                    {tool.configFields!.map((field) => (
                      <input
                        key={field}
                        value={metaFields[tool.slug]?.[field] ?? ''}
                        onChange={(e) =>
                          setMetaFields((prev) => ({
                            ...prev,
                            [tool.slug]: { ...(prev[tool.slug] ?? {}), [field]: e.target.value },
                          }))
                        }
                        placeholder={field}
                        className={AIVA_INPUT_CLASS}
                      />
                    ))}
                  </div>
                ) : null}
                <button
                  type="button"
                  disabled={busySlug === tool.slug || comingSoon}
                  onClick={() => void (connected ? disconnect(tool.slug) : connect(tool))}
                  className={cn(
                    'mt-3 inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-lg border px-3 text-sm font-medium',
                    connected
                      ? 'border-border text-text-secondary hover:bg-overlay'
                      : 'border-accent/40 bg-accent-dim text-accent hover:bg-accent/20',
                    comingSoon && 'cursor-not-allowed opacity-50',
                  )}
                >
                  {comingSoon ? (
                    'Coming soon'
                  ) : (
                    <>
                      {connected ? <Unplug className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
                      {busySlug === tool.slug
                        ? 'Working...'
                        : connected
                          ? 'Disconnect'
                          : isGoogleOauth
                            ? 'Connect with Google'
                            : 'Connect + probe'}
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
