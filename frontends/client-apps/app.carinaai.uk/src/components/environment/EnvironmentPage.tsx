'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, RefreshCw, Shield, ShieldAlert } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { cn } from '@/lib/utils';

type EnvironmentSetting = {
  key: string;
  value: string;
  source: 'process' | 'derived';
  sensitive: boolean;
};

type EnvironmentSummary = {
  generatedAt: string;
  carinaHome: string;
  envPath: string;
  envExists: boolean;
  envMode: string | null;
  settings: EnvironmentSetting[];
  audit: { ok: number; warn: number; fail: number };
  findings: Array<{
    id: string;
    severity: 'ok' | 'warn' | 'fail';
    source: string;
    key: string;
    detail: string;
  }>;
  precedenceDrift: string[];
  unresolvedRefs: string[];
};

type EnvResponse = {
  environment?: EnvironmentSummary;
  error?: string;
  warning?: string;
  source?: string;
};

async function readApiJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text.trim()) {
    throw new Error(`Server returned an empty response (HTTP ${res.status}).`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Server returned invalid JSON (HTTP ${res.status}).`);
  }
}

function severityClass(severity: 'ok' | 'warn' | 'fail'): string {
  if (severity === 'fail') return 'text-danger';
  if (severity === 'warn') return 'text-amber-400';
  return 'text-accent';
}

function formatTime(value: string): string {
  return new Date(value).toLocaleString();
}

export function EnvironmentPage() {
  const [environment, setEnvironment] = useState<EnvironmentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);
  const [error, setError] = useState('');

  const [warning, setWarning] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    setWarning('');
    try {
      const res = await fetch('/api/env', { cache: 'no-store' });
      const data = await readApiJson<EnvResponse>(res);
      if (!res.ok) throw new Error(data.error ?? 'Unable to load environment summary');
      setEnvironment(data.environment ?? null);
      setWarning(data.warning ?? '');
    } catch (err) {
      setEnvironment(null);
      setWarning('');
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const summary = environment?.audit ?? { ok: 0, warn: 0, fail: 0 };
  const totalSettings = environment?.settings.length ?? 0;

  const riskTone = useMemo(() => {
    if (summary.fail > 0) return 'danger';
    if (summary.warn > 0) return 'warn';
    return 'ok';
  }, [summary.fail, summary.warn]);

  async function reloadEnv() {
    setReloading(true);
    setError('');
    try {
      const res = await fetch('/api/env/reload', { method: 'POST' });
      const data = await readApiJson<EnvResponse & { ok?: boolean }>(res);
      if (!res.ok) throw new Error(data.error ?? 'Unable to reload environment');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setReloading(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="border-b border-border px-6 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold text-text-primary">Environment</h1>
            <p className="text-xs text-text-muted">
              Sanitized environment summary and secret-audit results. Sensitive values stay masked.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-xs text-text-secondary hover:text-text-primary"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => void reloadEnv()}
              disabled={reloading}
              className="inline-flex items-center gap-2 rounded-md bg-accent px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
            >
              <Shield className="h-3.5 w-3.5" />
              {reloading ? 'Reloading' : 'Reload from file'}
            </button>
          </div>
        </div>
        {warning ? <p className="mt-2 text-xs text-amber-400">{warning}</p> : null}
        {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 xl:grid-cols-[0.92fr_1.08fr]">
        <section className="min-h-0 border-r border-border p-6">
          {loading ? (
            <EmptyState title="Loading environment" subtitle="Reading the current summary and audit snapshot." />
          ) : environment ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label="Audit ok" value={summary.ok} tone="ok" />
                <StatCard label="Warnings" value={summary.warn} tone="warn" />
                <StatCard label="Failures" value={summary.fail} tone="danger" />
                <StatCard label="Settings" value={totalSettings} tone={riskTone} />
              </div>

              <div className="rounded-xl border border-border bg-surface p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                  Environment file
                </p>
                <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                  <Row label="Carina home" value={environment.carinaHome} />
                  <Row label="Env path" value={environment.envPath} />
                  <Row label="Env file" value={environment.envExists ? 'Present' : 'Missing'} />
                  <Row label="Mode" value={environment.envMode ? `0o${environment.envMode}` : 'Unavailable'} />
                  <Row label="Generated" value={formatTime(environment.generatedAt)} />
                  <Row label="Source" value="Secrets audit and process summary" />
                </dl>
              </div>

              <div className="rounded-xl border border-border bg-surface p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                  Summary notes
                </p>
                <ul className="mt-3 space-y-2 text-sm text-text-secondary">
                  <li>Sensitive keys are shown only as present or absent.</li>
                  <li>Public runtime values stay visible when they are not secret material.</li>
                  <li>Reload uses the current env file and refreshes the summary only.</li>
                </ul>
              </div>
            </div>
          ) : null}
        </section>

        <aside className="min-h-0 overflow-y-auto p-6">
          {environment ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-surface p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                      Environment settings
                    </p>
                    <p className="text-xs text-text-muted">
                      Non-sensitive values are shown directly. Secret-like keys are redacted.
                    </p>
                  </div>
                  <span className="text-xs text-text-muted">{environment.settings.length} entries</span>
                </div>

                <div className="mt-4 overflow-hidden rounded-lg border border-border">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-base text-text-muted">
                      <tr>
                        <th className="px-3 py-2 font-medium">Key</th>
                        <th className="px-3 py-2 font-medium">Value</th>
                        <th className="px-3 py-2 font-medium">Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {environment.settings.map((item) => (
                        <tr key={item.key} className="border-t border-border">
                          <td className="px-3 py-2 font-medium text-text-primary">{item.key}</td>
                          <td className="px-3 py-2 text-text-secondary">{item.value}</td>
                          <td className="px-3 py-2 text-text-muted">
                            {item.sensitive ? 'masked' : 'public'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-surface p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                  Secret audit findings
                </p>
                {environment.findings.length === 0 ? (
                  <p className="mt-3 text-sm text-text-secondary">No findings recorded.</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {environment.findings.map((finding) => (
                      <div key={finding.id} className="rounded-lg border border-border px-3 py-2">
                        <div className="flex flex-wrap items-center gap-2 text-[11px]">
                          <span className={cn('font-medium uppercase', severityClass(finding.severity))}>
                            {finding.severity}
                          </span>
                          <span className="text-text-muted">{finding.source}</span>
                          <span className="text-text-muted">{finding.key}</span>
                        </div>
                        <p className="mt-1 text-xs text-text-secondary">{finding.detail}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <InfoPanel
                  title="Precedence drift"
                  icon={<AlertTriangle className="h-3.5 w-3.5 text-amber-400" />}
                  items={environment.precedenceDrift}
                  emptyLabel="No precedence drift detected."
                />
                <InfoPanel
                  title="Unresolved refs"
                  icon={<ShieldAlert className="h-3.5 w-3.5 text-danger" />}
                  items={environment.unresolvedRefs}
                  emptyLabel="No unresolved references detected."
                />
              </div>
            </div>
          ) : loading ? null : (
            <EmptyState title="No environment data" subtitle="The summary endpoint did not return data." />
          )}
        </aside>
      </div>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: 'ok' | 'warn' | 'danger' }) {
  const toneClass =
    tone === 'danger' ? 'text-danger' : tone === 'warn' ? 'text-amber-400' : 'text-accent';
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">{label}</p>
      <p className={cn('mt-2 text-2xl font-semibold', toneClass)}>{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">{label}</dt>
      <dd className="mt-1 break-all text-sm text-text-secondary">{value}</dd>
    </div>
  );
}

function InfoPanel({
  title,
  icon,
  items,
  emptyLabel,
}: {
  title: string;
  icon: React.ReactNode;
  items: string[];
  emptyLabel: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center gap-2">
        {icon}
        <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">{title}</p>
      </div>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-text-secondary">{emptyLabel}</p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm text-text-secondary">
          {items.map((item) => (
            <li key={item} className="rounded-lg border border-border px-3 py-2">
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
