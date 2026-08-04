'use client';

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { AttestationCell } from '@/components/fleet/FleetUi';
import { TableSkeleton } from '@/components/ui/Skeleton';

interface AttestationReport {
  totalRecords: number;
  confirmed: number;
  pending: number;
  failed: number;
  coveragePercent: number;
  last24hTotal: number;
  last24hConfirmed: number;
  last24hCoverage: number;
  byWorker: Array<{
    workerId: string;
    workerName: string;
    workspaceId: string;
    workspaceName: string;
    total: number;
    confirmed: number;
    coverage: number;
  }>;
}

interface UnattestedRecord {
  id: string;
  workerId: string;
  workerName: string;
  workspaceId: string;
  workspaceName: string;
  actionType: string;
  createdAt: string;
}

function coverageTextColor(pct: number): string {
  if (pct >= 95) return 'text-green-400';
  if (pct >= 80) return 'text-amber-400';
  return 'text-red-400';
}

function CoverageCard({ pct }: { pct: number }) {
  const bgClass = pct >= 95 ? 'bg-green-500/10' : pct >= 80 ? 'bg-amber-500/10' : 'bg-red-500/10';
  const textClass = coverageTextColor(pct);
  return (
    <div className={`rounded-lg border border-border p-4 ${bgClass}`}>
      <p className={`text-4xl font-semibold ${textClass}`}>{pct.toFixed(1)}%</p>
      <p className="mt-0.5 text-xs text-text-muted">Coverage</p>
    </div>
  );
}

function StatCard({
  label,
  value,
  colorClass = 'text-text-primary',
}: {
  label: string;
  value: string;
  colorClass?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-elevated p-4">
      <p className="text-xs text-text-muted">{label}</p>
      <p className={`mt-2 text-xl font-semibold ${colorClass}`}>{value}</p>
    </div>
  );
}

async function retryActivity(id: string): Promise<boolean> {
  const res = await fetch(`/api/admin/attestation/retry/${id}`, { method: 'POST' });
  if (!res.ok) return false;
  const body = (await res.json()) as { attestationTx?: string | null };
  return Boolean(body.attestationTx);
}

function RetryAllButton({ workerId, failedCount }: { workerId: string; failedCount: number }) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, confirmed: 0 });
  const [message, setMessage] = useState('');

  async function run() {
    if (failedCount <= 0 || running) return;
    setRunning(true);
    setMessage('');
    try {
      const ids: string[] = [];
      let page = 1;
      let hasMore = true;
      while (hasMore) {
        const res = await fetch(
          `/api/admin/attestation/unattested?workerId=${workerId}&page=${page}&limit=100`,
        );
        const body = (await res.json()) as { records?: UnattestedRecord[] };
        const batch = body.records ?? [];
        ids.push(...batch.map((r) => r.id));
        hasMore = batch.length === 100;
        page += 1;
      }

      setProgress({ done: 0, total: ids.length, confirmed: 0 });
      let confirmed = 0;
      for (let i = 0; i < ids.length; i++) {
        if (await retryActivity(ids[i])) confirmed += 1;
        setProgress({ done: i + 1, total: ids.length, confirmed });
      }
      setMessage(`Done. ${confirmed} confirmed, ${ids.length - confirmed} still pending`);
    } catch {
      setMessage('Retry failed');
    } finally {
      setRunning(false);
    }
  }

  if (failedCount <= 0) return <span className="text-text-muted">-</span>;

  return (
    <div className="min-w-[120px]">
      <button
        type="button"
        disabled={running}
        onClick={() => void run()}
        className="text-[11px] text-accent hover:underline disabled:opacity-50"
      >
        {running
          ? `Retrying ${progress.total}... (${progress.done} done)`
          : `Retry all failed (${failedCount})`}
      </button>
      {running && progress.total > 0 ? (
        <div className="mt-1 h-1 w-full overflow-hidden rounded bg-overlay">
          <div
            className="h-full bg-accent transition-all"
            style={{ width: `${(progress.done / progress.total) * 100}%` }}
          />
        </div>
      ) : null}
      {message ? <p className="mt-1 text-[10px] text-text-muted">{message}</p> : null}
    </div>
  );
}

function UnattestedRow({
  rec,
  onRetried,
}: {
  rec: UnattestedRecord;
  onRetried: (id: string) => void;
}) {
  const [fading, setFading] = useState(false);
  const [loading, setLoading] = useState(false);

  async function retry() {
    setLoading(true);
    try {
      const ok = await retryActivity(rec.id);
      if (ok) {
        setFading(true);
        setTimeout(() => onRetried(rec.id), 300);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <tr
      className={[
        'border-b border-border transition-opacity duration-300',
        fading ? 'opacity-0' : 'opacity-100',
      ].join(' ')}
    >
      <td className="px-4 py-2.5 font-mono text-[10px] text-text-muted">{rec.id.slice(0, 12)}...</td>
      <td className="px-4 py-2.5 text-text-primary">{rec.workerName}</td>
      <td className="px-4 py-2.5">
        <Link href={`/customers/${rec.workspaceId}`} className="text-accent hover:underline">
          {rec.workspaceName}
        </Link>
      </td>
      <td className="px-4 py-2.5 font-mono text-text-muted">{rec.actionType}</td>
      <td className="px-4 py-2.5 text-text-muted">{new Date(rec.createdAt).toLocaleString()}</td>
      <td className="px-4 py-2.5">
        <button
          type="button"
          disabled={loading || fading}
          onClick={() => void retry()}
          className="text-[11px] text-accent hover:underline disabled:opacity-50"
        >
          {loading ? '...' : 'Retry'}
        </button>
      </td>
    </tr>
  );
}

function RetryAllOnPageButton({
  records,
  onComplete,
}: {
  records: UnattestedRecord[];
  onComplete: (succeededIds: string[]) => void;
}) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [banner, setBanner] = useState('');

  async function run() {
    if (records.length === 0 || running) return;
    setRunning(true);
    setBanner(`Retrying ${records.length} records... (0 done)`);
    const succeeded: string[] = [];
    for (let i = 0; i < records.length; i++) {
      if (await retryActivity(records[i].id)) succeeded.push(records[i].id);
      setProgress({ done: i + 1, total: records.length });
      setBanner(`Retrying ${records.length} records... (${i + 1} done)`);
    }
    setBanner(`Complete: ${succeeded.length} of ${records.length} confirmed on-chain`);
    onComplete(succeeded);
    setRunning(false);
  }

  return (
    <div>
      {banner ? (
        <p className="mb-2 rounded border border-border bg-overlay px-3 py-2 text-xs text-text-secondary">
          {banner}
        </p>
      ) : null}
      <button
        type="button"
        disabled={running || records.length === 0}
        onClick={() => void run()}
        className="text-xs text-accent hover:underline disabled:opacity-50"
      >
        {running ? `Retrying (${progress.done}/${progress.total})` : 'Retry all on page'}
      </button>
    </div>
  );
}

export default function AttestationReportPage() {
  const [report, setReport] = useState<AttestationReport | null>(null);
  const [unattested, setUnattested] = useState<UnattestedRecord[]>([]);
  const [unattestedPage, setUnattestedPage] = useState(1);
  const [unattestedHasMore, setUnattestedHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [unattestedLoading, setUnattestedLoading] = useState(false);
  const [error, setError] = useState('');

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/attestation/report');
      const body = (await res.json()) as AttestationReport & { error?: string };
      if (!res.ok) throw new Error(body.error ?? 'Failed to load report');
      setReport(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadUnattested = useCallback(async (page: number, append: boolean) => {
    setUnattestedLoading(true);
    try {
      const res = await fetch(`/api/admin/attestation/unattested?page=${page}&limit=50`);
      const body = (await res.json()) as { records?: UnattestedRecord[] };
      if (!res.ok) return;
      const rows = body.records ?? [];
      setUnattested((prev) => (append ? [...prev, ...rows] : rows));
      setUnattestedHasMore(rows.length === 50);
      setUnattestedPage(page);
    } finally {
      setUnattestedLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReport();
    void loadUnattested(1, false);
  }, [loadReport, loadUnattested]);

  function removeUnattested(id: string) {
    setUnattested((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <div className="mx-auto max-w-6xl px-8 py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Attestation coverage</h1>
          <p className="mt-0.5 text-sm text-text-muted">
            On-chain verification of all Aiva activity records
          </p>
        </div>
        <Link href="/fleet" className="flex items-center gap-1 text-xs text-accent hover:underline">
          <ChevronLeft className="h-3 w-3" /> Back to Fleet
        </Link>
      </div>

      {loading ? <TableSkeleton rows={4} cols={5} /> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {report ? (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <StatCard label="Total records" value={report.totalRecords.toLocaleString()} />
            <StatCard label="Confirmed" value={report.confirmed.toLocaleString()} />
            <StatCard label="Pending" value={report.pending.toLocaleString()} />
            <StatCard
              label="Failed"
              value={report.failed.toLocaleString()}
              colorClass="text-red-400"
            />
            <CoverageCard pct={report.coveragePercent} />
          </div>

          <div className="mb-8 flex flex-wrap items-center gap-6 text-xs text-text-muted">
            <span>Last 24h:</span>
            <span>{report.last24hTotal.toLocaleString()} records</span>
            <span>{report.last24hConfirmed.toLocaleString()} confirmed</span>
            <span className={coverageTextColor(report.last24hCoverage)}>
              {report.last24hCoverage.toFixed(1)}% coverage
            </span>
          </div>

          <div className="mb-8">
            <h2 className="mb-3 text-sm font-medium text-text-primary">
              Active Aivas with lowest attestation coverage
            </h2>
            <p className="mb-3 text-xs text-text-muted">
              Fired Aivas are hidden here. Their past records still count in the totals above.
            </p>
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-overlay text-[11px] text-text-muted">
                    <th className="px-4 py-2.5 text-left font-medium">Aiva</th>
                    <th className="px-4 py-2.5 text-left font-medium">Workspace</th>
                    <th className="px-4 py-2.5 text-left font-medium">Total</th>
                    <th className="px-4 py-2.5 text-left font-medium">Confirmed</th>
                    <th className="px-4 py-2.5 text-left font-medium">Coverage</th>
                    <th className="px-4 py-2.5 text-left font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {report.byWorker.map((row) => (
                    <tr key={row.workerId}>
                      <td className="px-4 py-2.5 font-medium text-text-primary">{row.workerName}</td>
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/customers/${row.workspaceId}`}
                          className="text-accent hover:underline"
                        >
                          {row.workspaceName}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-text-muted">{row.total.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-text-muted">{row.confirmed.toLocaleString()}</td>
                      <td className="px-4 py-2.5">
                        <AttestationCell coverage={row.coverage} />
                      </td>
                      <td className="px-4 py-2.5">
                        <RetryAllButton
                          workerId={row.workerId}
                          failedCount={row.total - row.confirmed}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-medium text-text-primary">
                All unattested records (oldest first)
              </h2>
              <RetryAllOnPageButton
                records={unattested}
                onComplete={(ids) => {
                  setUnattested((prev) => prev.filter((r) => !ids.includes(r.id)));
                  void loadReport();
                }}
              />
            </div>
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-overlay text-[11px] text-text-muted">
                    <th className="px-4 py-2.5 text-left font-medium">Activity ID</th>
                    <th className="px-4 py-2.5 text-left font-medium">Aiva</th>
                    <th className="px-4 py-2.5 text-left font-medium">Workspace</th>
                    <th className="px-4 py-2.5 text-left font-medium">Action type</th>
                    <th className="px-4 py-2.5 text-left font-medium">Created</th>
                    <th className="w-16" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {unattested.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-text-muted">
                        {unattestedLoading ? 'Loading...' : 'No unattested records past grace period.'}
                      </td>
                    </tr>
                  ) : (
                    unattested.map((rec) => (
                      <UnattestedRow key={rec.id} rec={rec} onRetried={removeUnattested} />
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {unattestedHasMore ? (
              <button
                type="button"
                disabled={unattestedLoading}
                onClick={() => void loadUnattested(unattestedPage + 1, true)}
                className="mt-3 text-xs text-accent hover:underline disabled:opacity-50"
              >
                {unattestedLoading ? 'Loading...' : 'Load more'}
              </button>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
