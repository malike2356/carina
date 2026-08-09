'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AIVA_INPUT_CLASS } from '@/lib/aiva-utils';
import { readJsonResponse } from '@/lib/read-json-response';
import { cn } from '@/lib/utils';
import { GuideMeLink } from '@/components/integrations/GuideMeLink';
import { guideIdForTool } from '@/lib/integration-guides';

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
  lastProbeError?: string | null;
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
  const selectedGuideId = guideIdForTool(toolSlug);

  async function load() {
    try {
      setError('');
      const [featuresRes, catalogRes, accountsRes, workersRes] = await Promise.all([
        fetch('/api/aiva/features'),
        fetch('/api/aiva/tools/catalog'),
        fetch('/api/aiva/tool-accounts'),
        fetch('/api/aiva/workers'),
      ]);
      const featuresData = await readJsonResponse<{
        features?: { tools?: { accountsEnabled?: boolean } };
        error?: string;
      }>(featuresRes, 'Tool settings');
      if (!featuresRes.ok) {
        setError(featuresData.error ?? 'Could not load tool settings');
      } else {
        setAccountsEnabled(featuresData.features?.tools?.accountsEnabled !== false);
      }

      const catalogData = await readJsonResponse<{ tools?: ProductTool[]; error?: string }>(
        catalogRes,
        'Tool catalog',
      );
      if (!catalogRes.ok) {
        setError(catalogData.error ?? 'Could not load tool catalog');
      } else {
        const liveTools = (catalogData.tools ?? []).filter((tool) => tool.status !== 'coming_soon');
        setTools(liveTools);
        const requested = searchParams.get('tool')?.trim() ?? '';
        if (requested && liveTools.some((tool) => tool.slug === requested)) {
          setToolSlug(requested);
        } else if (liveTools.length > 0 && !liveTools.some((tool) => tool.slug === toolSlug)) {
          setToolSlug(liveTools[0]!.slug);
        }
      }

      const accountsData = await readJsonResponse<{ accounts?: ToolAccount[]; error?: string }>(
        accountsRes,
        'Tool accounts',
      );
      if (!accountsRes.ok) {
        setError(accountsData.error ?? 'Could not load accounts');
      } else {
        setAccounts(accountsData.accounts ?? []);
      }

      const workersData = await readJsonResponse<{ workers?: WorkerRow[]; error?: string }>(
        workersRes,
        'Aiva workers',
      );
      if (!workersRes.ok) {
        setError(workersData.error ?? 'Could not load Aivas');
        setWorkers([]);
        setGrantWorkerId('');
        return;
      }
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
    function onOrgChanged() {
      void load();
    }
    window.addEventListener('aiva-org-changed', onOrgChanged);
    return () => window.removeEventListener('aiva-org-changed', onOrgChanged);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when org switcher fires
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
    await connectGoogleAccountForTool(selectedTool?.slug || 'google-drive');
  }

  async function connectGoogleAccountForTool(targetToolSlug: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const qs = new URLSearchParams({
        mode: 'account',
        toolSlug: targetToolSlug,
        returnPath: `/aiva/tools?tool=${encodeURIComponent(targetToolSlug)}`,
        redirectUri: `${window.location.origin}/api/aiva/tools/oauth/google/callback`,
      });
      const res = await fetch(`/api/aiva/tools/oauth/google/auth-url?${qs.toString()}`);
      const data = await readJsonResponse<{ authUrl?: string; error?: string }>(
        res,
        'Google OAuth',
      );
      if (!res.ok || !data.authUrl) {
        throw new Error(data.error ?? 'Could not start Google OAuth');
      }
      window.location.href = data.authUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google connect failed');
      setBusy(false);
    }
  }

  function isGoogleOauthToolSlug(slug: string) {
    return slug === 'gmail' || slug === 'google-drive' || slug.startsWith('google-');
  }

  function isGmailAccount(account: ToolAccount) {
    return account.toolSlug === 'gmail' || /gmail/i.test(account.label);
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
      const data = await readJsonResponse<{ ok?: boolean; error?: string; account?: ToolAccount }>(
        res,
        'Create tool account',
      );
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

  async function grantOne(accountId: string, workerId: string) {
    const res = await fetch(`/api/aiva/tool-accounts/${encodeURIComponent(accountId)}/grant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workerId }),
    });
    const data = await readJsonResponse<{ error?: string; grants?: unknown[] }>(res, 'Grant tool');
    if (!res.ok) {
      throw new Error(data.error ?? 'Grant failed');
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
      await grantOne(accountId, workerId);
      const workerName = workers.find((worker) => worker.id === workerId)?.name ?? 'worker';
      const accountLabel = accounts.find((row) => row.id === accountId)?.label ?? 'account';
      setNotice(
        `Granted ${accountLabel} to ${workerName}. Use Grant all to attach every connected account.`,
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Grant failed');
    } finally {
      setBusy(false);
    }
  }

  async function grantAllConnected() {
    const workerId = grantWorkerId || workers[0]?.id || '';
    if (!workerId) {
      setError('Select an Aiva worker to grant. Hire an Aiva first if the list is empty.');
      return;
    }
    const connected = accounts.filter((account) => account.status === 'connected');
    if (connected.length === 0) {
      setError('No connected accounts to grant. Reconnect any that still need auth.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    const failures: string[] = [];
    try {
      for (const account of connected) {
        try {
          await grantOne(account.id, workerId);
        } catch (err) {
          failures.push(
            `${account.label} (${account.toolSlug}): ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
      const workerName = workers.find((worker) => worker.id === workerId)?.name ?? 'worker';
      const okCount = connected.length - failures.length;
      if (failures.length === 0) {
        setNotice(`Granted all ${okCount} connected account(s) to ${workerName}.`);
      } else {
        setNotice(`Granted ${okCount} of ${connected.length} to ${workerName}.`);
        setError(failures.slice(0, 3).join(' · '));
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Grant all failed');
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
        const data = await readJsonResponse<{ error?: string }>(res, 'Delete tool account');
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

  function beginReconnect(account: ToolAccount) {
    if (isGoogleOauthToolSlug(account.toolSlug)) {
      void reconnectGoogleAccount(account);
      return;
    }
    setToolSlug(account.toolSlug);
    setLabel(account.label);
    setToken('');
    setMeta({});
    setError('');
    const tool = tools.find((row) => row.slug === account.toolSlug);
    const needsApiKey = (tool?.configFields ?? []).includes('apiKey');
    setNotice(
      needsApiKey
        ? `Reconnect ${account.label}: paste a fresh API token and apiKey below, then Create + probe. Existing apiKey is kept if you leave that field blank.`
        : `Reconnect ${account.label}: paste a fresh API token / secret below, then Create + probe.`,
    );
    document.getElementById('aiva-add-tool-account')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function reconnectGoogleAccount(account: ToolAccount) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      setToolSlug(account.toolSlug);
      setLabel(account.label);
      const qs = new URLSearchParams({
        mode: 'account',
        toolSlug: account.toolSlug,
        returnPath: `/aiva/tools?tool=${encodeURIComponent(account.toolSlug)}`,
        redirectUri: `${window.location.origin}/api/aiva/tools/oauth/google/callback`,
      });
      const res = await fetch(`/api/aiva/tools/oauth/google/auth-url?${qs.toString()}`);
      const data = await readJsonResponse<{ authUrl?: string; error?: string }>(
        res,
        'Google OAuth reconnect',
      );
      if (!res.ok || !data.authUrl) {
        throw new Error(data.error ?? 'Could not start Google reconnect');
      }
      setNotice(`Reconnect ${account.label} in Google, then return here to grant it again.`);
      window.location.href = data.authUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google reconnect failed');
      setBusy(false);
    }
  }

  async function reprobeAccount(accountId: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await fetch(`/api/aiva/tool-accounts/${encodeURIComponent(accountId)}/probe`, {
        method: 'POST',
      });
      const data = await readJsonResponse<{ ok?: boolean; error?: string; account?: ToolAccount }>(
        res,
        'Re-probe tool account',
      );
      if (!res.ok || data.ok === false) {
        setError(data.error ?? 'Re-probe failed');
        await load();
        return;
      }
      setNotice(`Account ${data.account?.label ?? accountId} probe succeeded.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Re-probe failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full min-w-0 max-w-none space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Tool accounts</h1>
        <p className="mt-1 text-sm text-text-muted">
          Connect once at workspace level, then grant to any worker. Channels stay under{' '}
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

      <section id="aiva-add-tool-account" className="space-y-3 rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-text-primary">Add account</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block text-xs text-text-muted">Tool</span>
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
            <span className="mb-1 block text-xs text-text-muted">Label</span>
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
            <p className="text-xs text-text-muted">
              Connect Google once, then Grant below for each Aiva.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={busy || !accountsEnabled}
                onClick={() => void connectGoogleAccount()}
                className="btn-primary h-9 px-3 text-sm"
              >
                {busy ? 'Working...' : 'Connect with Google'}
              </button>
              {selectedGuideId ? (
                <GuideMeLink guideId={selectedGuideId} variant="pill" />
              ) : null}
            </div>
          </div>
        ) : selectedTool?.auth === 'vault' || selectedTool?.auth === 'api_key' ? (
          <label className="block text-sm">
            <span className="mb-1 block text-xs text-text-muted">API token / secret</span>
            <input
              type="password"
              className={AIVA_INPUT_CLASS}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              autoComplete="off"
            />
          </label>
        ) : (
          <p className="text-xs text-text-muted">
            This tool uses per-worker connect on the Aiva Tools tab, or paste credentials when fields
            appear.
          </p>
        )}
        {(selectedTool?.configFields ?? []).map((field) => (
          <label key={field} className="block text-sm">
            <span className="mb-1 block text-xs text-text-muted">
              {field === 'apiKey' && selectedTool?.slug === 'trello' ? 'Trello API key' : field}
            </span>
            <input
              className={AIVA_INPUT_CLASS}
              value={meta[field] ?? ''}
              onChange={(e) => setMeta((prev) => ({ ...prev, [field]: e.target.value }))}
              placeholder={
                field === 'apiKey' && selectedTool?.slug === 'trello'
                  ? 'From trello.com/power-ups/admin'
                  : field
              }
            />
          </label>
        ))}
        {!isGoogleOauthTool ? (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {selectedGuideId ? (
              <GuideMeLink guideId={selectedGuideId} variant="pill" />
            ) : null}
            <button
              type="button"
              disabled={busy || !accountsEnabled}
              onClick={() => void createAccount()}
              className="btn-primary h-9 px-3 text-sm disabled:opacity-60"
            >
              {busy ? 'Working...' : 'Create + probe'}
            </button>
          </div>
        ) : null}
      </section>

      <section className="space-y-3 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-sm font-semibold text-text-primary">Connected accounts</h2>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-sm">
              <span className="mb-1 block text-xs text-text-muted">Grant to worker</span>
              <select
                className={cn(AIVA_INPUT_CLASS, 'min-w-[10rem]')}
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
            <button
              type="button"
              disabled={
                busy
                || !accountsEnabled
                || workers.length === 0
                || !accounts.some((account) => account.status === 'connected')
              }
              onClick={() => void grantAllConnected()}
              className="h-9 rounded-lg border border-border px-3 text-sm font-medium text-text-secondary hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-50"
              title="Grant every connected account to the selected Aiva"
            >
              {busy ? 'Working...' : 'Grant all'}
            </button>
          </div>
        </div>
        <p className="text-xs text-text-muted">
          Use Grant all for every connected account, or Grant on a row for that account only.
        </p>
        {workers.length === 0 ? (
          <p className="text-sm text-amber-700 dark:text-amber-300">
            {error
              ? 'Could not load Aivas (see error above). Refresh the page or sign out and back in, then open AI Workers to confirm your Aivas are listed.'
              : (
                <>
                  No Aivas available to grant to yet.{' '}
                  <Link href="/aiva/workers" className="underline underline-offset-2 hover:text-accent">
                    Open AI Workers
                  </Link>
                  {' '}to hire one, or use the Organization switcher in the sidebar if you have more than one org.
                </>
              )}
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
              const gmailNeedsReauth = account.status === 'needs_reauth' && isGmailAccount(account);
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
                        {account.lastProbeError ? ` (${account.lastProbeError.slice(0, 160)})` : ''}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {account.status !== 'connected' ? (
                      <>
                        {gmailNeedsReauth ? (
                          <button
                            type="button"
                            disabled={busy || !accountsEnabled}
                            onClick={() => void reconnectGoogleAccount(account)}
                            className="rounded-lg border border-accent/40 bg-accent px-3 py-1.5 text-xs font-medium text-white"
                          >
                            Reconnect Gmail
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={busy || !accountsEnabled}
                            onClick={() => beginReconnect(account)}
                            className="rounded-lg border border-accent/40 bg-accent-dim px-3 py-1.5 text-xs font-medium text-accent"
                          >
                            Reconnect
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={busy || !accountsEnabled}
                          onClick={() => void reprobeAccount(account.id)}
                          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary"
                          title="Retry probe with stored credentials"
                        >
                          Re-probe
                        </button>
                      </>
                    ) : null}
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
                          : 'Grant only this account to the selected Aiva'
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
