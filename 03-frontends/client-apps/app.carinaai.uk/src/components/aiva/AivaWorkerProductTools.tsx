'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Check, ChevronDown } from 'lucide-react';
import { AIVA_INPUT_CLASS } from '@/lib/aiva-utils';
import { cn } from '@/lib/utils';
import { GuideMeLink } from '@/components/integrations/GuideMeLink';
import { guideIdForTool } from '@/lib/integration-guides';
import { humanizeToolError } from '@/lib/humanize-tool-error';

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
  lastProbeOk?: boolean | null;
  lastProbeError?: string | null;
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

function scopeSummary(scopes: string[]): string {
  if (scopes.length === 0) return '';
  if (scopes.length <= 2) return scopes.join(', ');
  return `${scopes.slice(0, 2).join(', ')} +${scopes.length - 2}`;
}

function authLabel(tool: ProductTool): string {
  if (tool.auth === 'oauth') return 'OAuth';
  if (tool.auth === 'vault' || tool.auth === 'api_key') return 'API key';
  return tool.auth ?? '';
}

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
  const [cardError, setCardError] = useState<Record<string, string>>({});
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

  const grantBySlug = useMemo(
    () => new Map(grants.map((grant) => [grant.toolSlug, grant])),
    [grants],
  );
  const accountGrantBySlug = useMemo(
    () => new Map(accountGrants.map((grant) => [grant.toolSlug, grant])),
    [accountGrants],
  );

  const visible = useMemo(
    () => tools.filter((tool) => filter === 'all' || tool.category === filter),
    [tools, filter],
  );

  const connectedTools = useMemo(
    () =>
      visible.filter((tool) => {
        const grant = grantBySlug.get(tool.slug);
        const accountGrant = accountGrantBySlug.get(tool.slug);
        return grant?.status === 'connected' || accountGrant?.status === 'connected';
      }),
    [visible, grantBySlug, accountGrantBySlug],
  );

  const availableTools = useMemo(
    () =>
      visible.filter((tool) => {
        const grant = grantBySlug.get(tool.slug);
        const accountGrant = accountGrantBySlug.get(tool.slug);
        return !(grant?.status === 'connected' || accountGrant?.status === 'connected');
      }),
    [visible, grantBySlug, accountGrantBySlug],
  );

  async function startGoogleOAuth(tool: ProductTool) {
    const returnPath = `/aiva/workers/${workerId}?tab=tools`;
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
    setCardError((prev) => {
      const next = { ...prev };
      delete next[tool.slug];
      return next;
    });
    setNotice('');
    try {
      if (tool.auth === 'oauth' && (tool.oauthProvider === 'google_workspace' || tool.category === 'google')) {
        await startGoogleOAuth(tool);
        return;
      }

      if (tool.auth === 'vault' && !vaultValue[tool.slug]?.trim()) {
        setCardError((prev) => ({
          ...prev,
          [tool.slug]: `Enter an API token / secret for ${tool.label} before Connect + probe.`,
        }));
        return;
      }
      const missingFields = (tool.configFields ?? []).filter(
        (field) => !(metaFields[tool.slug]?.[field] ?? '').trim(),
      );
      if (missingFields.length > 0) {
        setCardError((prev) => ({
          ...prev,
          [tool.slug]: `${tool.label} needs: ${missingFields.join(', ')}. Fill those fields first.`,
        }));
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
        setCardError((prev) => ({
          ...prev,
          [tool.slug]: humanizeToolError(data.error, tool.label),
        }));
        await load();
        return;
      }
      setVaultValue((prev) => ({ ...prev, [tool.slug]: '' }));
      setNotice(`${tool.label} connected.`);
      await load();
    } catch (err) {
      setCardError((prev) => ({
        ...prev,
        [tool.slug]: humanizeToolError(
          err instanceof Error ? err.message : 'Connect/probe failed',
          tool.label,
        ),
      }));
    } finally {
      setBusySlug('');
    }
  }

  async function disconnect(slug: string) {
    setBusySlug(slug);
    setError('');
    setCardError((prev) => {
      const next = { ...prev };
      delete next[slug];
      return next;
    });
    try {
      const res = await fetch(`/api/aiva/workers/${workerId}/tools/${encodeURIComponent(slug)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? 'Could not disconnect tool');
        return;
      }
      setVaultValue((prev) => ({ ...prev, [slug]: '' }));
      setMetaFields((prev) => {
        const next = { ...prev };
        delete next[slug];
        return next;
      });
      setNotice('Cleared stored credentials. Paste a new token and Connect + probe again.');
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
    <section id="product-tools" className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 max-w-2xl">
          <h3 className="text-lg font-medium tracking-tight text-text-primary">Product tools</h3>
          <p className="mt-1 text-sm text-text-muted">
            Connect services this Aiva can use. Prefer a shared account from{' '}
            <a href="/aiva/tools" className="text-text-primary underline underline-offset-2 hover:text-accent">
              Tool accounts
            </a>
            , then grant it here.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative inline-flex items-center">
            <span className="sr-only">Category</span>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className={cn(
                AIVA_INPUT_CLASS,
                'h-9 min-w-[9.5rem] appearance-none py-1.5 pr-8 text-sm capitalize',
              )}
            >
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category === 'all' ? 'All categories' : category}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-text-muted" />
          </label>
          <GuideMeLink guideId="google-tools" className="text-sm" />
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {humanizeToolError(error)}
        </p>
      ) : null}
      {notice ? (
        <p className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-300">
          {notice}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-text-muted">Loading tools...</p>
      ) : (
        <div className="space-y-8">
          {connectedTools.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-baseline justify-between gap-3">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                  Connected
                </h4>
                <span className="text-xs text-text-muted">{connectedTools.length}</span>
              </div>
              <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {connectedTools.map((tool) => {
                  const accountGrant = accountGrantBySlug.get(tool.slug);
                  const toolGuideId = guideIdForTool(tool.slug);
                  return (
                    <li
                      key={tool.slug}
                      className="flex items-start gap-2.5 rounded-lg border border-border bg-surface-base px-3 py-2.5"
                    >
                      <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                        <Check className="h-2.5 w-2.5" strokeWidth={2.5} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-medium text-text-primary">
                            {tool.label}
                          </p>
                          <button
                            type="button"
                            disabled={busySlug === tool.slug}
                            onClick={() => void disconnect(tool.slug)}
                            className="shrink-0 text-xs font-medium text-text-muted hover:text-text-primary disabled:opacity-50"
                          >
                            {busySlug === tool.slug ? '...' : 'Remove'}
                          </button>
                        </div>
                        <p className="mt-0.5 truncate text-[11px] text-text-muted">
                          {accountGrant?.label
                            || [authLabel(tool), scopeSummary(tool.scopes)].filter(Boolean).join(' · ')}
                        </p>
                        {toolGuideId ? (
                          <GuideMeLink
                            guideId={toolGuideId}
                            label="Guide"
                            className="mt-1 text-[11px] font-normal text-text-muted hover:text-accent"
                          />
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          <div className="space-y-3">
            <div className="flex items-baseline justify-between gap-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                {connectedTools.length > 0 ? 'Available' : 'Catalog'}
              </h4>
              <span className="text-xs text-text-muted">{availableTools.length}</span>
            </div>

            {availableTools.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-text-muted">
                {filter === 'all'
                  ? 'All listed tools are connected.'
                  : `No tools left in ${filter}.`}
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {availableTools.map((tool) => {
                  const grant = grantBySlug.get(tool.slug);
                  const probeFailed =
                    grant?.status === 'needs_reauth'
                    || grant?.status === 'pending_probe'
                    || grant?.lastProbeOk === false;
                  const comingSoon = tool.status === 'coming_soon';
                  const isGoogleOauth =
                    tool.auth === 'oauth'
                    && (tool.oauthProvider === 'google_workspace' || tool.category === 'google');
                  const toolGuideId = guideIdForTool(tool.slug);
                  const reusable = workspaceAccounts.filter(
                    (account) => account.toolSlug === tool.slug && account.status === 'connected',
                  );

                  return (
                    <div
                      key={tool.slug}
                      className="flex flex-col rounded-xl border border-border bg-surface-base p-4"
                    >
                      <div className="mb-3 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-text-primary">{tool.label}</p>
                          <p className="mt-0.5 text-xs text-text-muted">
                            {[authLabel(tool), scopeSummary(tool.scopes), tool.category]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                        </div>
                        {toolGuideId && !comingSoon ? (
                          <GuideMeLink
                            guideId={toolGuideId}
                            label="Guide"
                            className="shrink-0 text-xs font-normal text-text-muted hover:text-accent"
                          />
                        ) : null}
                      </div>

                      {comingSoon ? (
                        <p className="mt-auto pt-2 text-xs text-text-muted">Coming soon</p>
                      ) : (
                        <div className="mt-auto space-y-2.5">
                          {probeFailed ? (
                            <p className="text-xs leading-relaxed text-amber-700 dark:text-amber-300">
                              {humanizeToolError(grant?.lastProbeError, tool.label)}
                            </p>
                          ) : null}
                          {cardError[tool.slug] ? (
                            <p className="text-xs leading-relaxed text-red-700 dark:text-red-300">
                              {cardError[tool.slug]}
                            </p>
                          ) : null}

                          {reusable.length > 0 ? (
                            <>
                              <select
                                className={cn(AIVA_INPUT_CLASS, 'h-9 py-1.5')}
                                value={pickAccount[tool.slug] ?? reusable[0]!.id}
                                onChange={(e) =>
                                  setPickAccount((prev) => ({
                                    ...prev,
                                    [tool.slug]: e.target.value,
                                  }))
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
                                className="btn-primary h-9 w-full text-sm disabled:opacity-60"
                              >
                                {busySlug === tool.slug ? 'Working...' : 'Grant account'}
                              </button>
                              {grant || accountGrantBySlug.get(tool.slug) ? (
                                <button
                                  type="button"
                                  disabled={busySlug === tool.slug}
                                  onClick={() => void disconnect(tool.slug)}
                                  className="h-9 w-full rounded-md border border-border text-sm text-text-secondary hover:bg-elevated disabled:opacity-60"
                                >
                                  {busySlug === tool.slug ? 'Working...' : 'Clear stored credentials'}
                                </button>
                              ) : null}
                            </>
                          ) : (
                            <>
                              {tool.auth === 'vault' ? (
                                <input
                                  type="password"
                                  value={vaultValue[tool.slug] ?? ''}
                                  onChange={(e) =>
                                    setVaultValue((prev) => ({
                                      ...prev,
                                      [tool.slug]: e.target.value,
                                    }))
                                  }
                                  placeholder="API token / secret"
                                  className={cn(AIVA_INPUT_CLASS, 'h-9 py-1.5')}
                                  autoComplete="off"
                                />
                              ) : null}
                              {(tool.configFields?.length ?? 0) > 0 ? (
                                <div className="space-y-2">
                                  {tool.configFields!.map((field) => (
                                    <input
                                      key={field}
                                      value={metaFields[tool.slug]?.[field] ?? ''}
                                      onChange={(e) =>
                                        setMetaFields((prev) => ({
                                          ...prev,
                                          [tool.slug]: {
                                            ...(prev[tool.slug] ?? {}),
                                            [field]: e.target.value,
                                          },
                                        }))
                                      }
                                      placeholder={field}
                                      className={cn(AIVA_INPUT_CLASS, 'h-9 py-1.5')}
                                    />
                                  ))}
                                </div>
                              ) : null}
                              <button
                                type="button"
                                disabled={busySlug === tool.slug}
                                onClick={() => void connect(tool)}
                                className="btn-primary h-9 w-full text-sm disabled:opacity-60"
                              >
                                {busySlug === tool.slug
                                  ? 'Working...'
                                  : isGoogleOauth
                                    ? 'Connect with Google'
                                    : 'Connect + probe'}
                              </button>
                              {grant || probeFailed ? (
                                <button
                                  type="button"
                                  disabled={busySlug === tool.slug}
                                  onClick={() => void disconnect(tool.slug)}
                                  className="h-9 w-full rounded-md border border-border text-sm text-text-secondary hover:bg-elevated disabled:opacity-60"
                                >
                                  {busySlug === tool.slug ? 'Working...' : 'Clear stored credentials'}
                                </button>
                              ) : null}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
