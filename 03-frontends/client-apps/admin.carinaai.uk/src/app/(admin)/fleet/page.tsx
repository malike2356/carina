'use client';

import Link from 'next/link';
import { ChevronDown, ChevronLeft, ChevronUp, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AivaStatusDot,
  AttestationCell,
  CriticalSignalToasts,
  LiveIndicator,
  maskIdentifier,
  SeverityBadge,
  type CriticalToast,
} from '@/components/fleet/FleetUi';
import { Modal } from '@/components/ui/Modal';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { timeAgo } from '@/lib/format';
import { useDebouncedValue } from '@/lib/use-debounced-value';

interface FleetAiva {
  workerId: string;
  name: string;
  role: string;
  status: string;
  workspaceId: string;
  workspaceName: string;
  ownerEmail?: string | null;
  escalationCount: number;
  escalationRate: number;
  recentSignalCount: number;
  highestRecentSeverity?: string | null;
  attestationCoverage: number;
  totalMessages: number;
}

interface FleetDetail extends FleetAiva {
  recentActivity?: Array<{
    id: string;
    actionType: string;
    summary: string;
    attestationTx?: string | null;
    createdAt: string;
  }>;
  recentSignals?: Array<{
    id: string;
    eventType: string;
    severity: string;
    summary: string;
    createdAt: string;
  }>;
  channels?: Array<{ channel: string; identifier: string; enabled: boolean }>;
  automations?: Array<{
    id: string;
    name: string;
    scheduleLabel: string;
    enabled: boolean;
    lastRunAt?: string | null;
    nextRunAt?: string | null;
  }>;
}

interface ScoutSignal {
  id: string;
  agentId: string;
  agentName: string;
  workspaceId: string;
  workspaceName: string;
  eventType: string;
  severity: string;
  summary: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  isNew?: boolean;
}

type Tab = 'aivas' | 'signals';

function rowBorder(aiva: FleetAiva): string {
  if (aiva.highestRecentSeverity === 'critical') return 'border-l-2 border-red-500/40 bg-red-500/5';
  if (aiva.escalationRate > 0.2) return 'border-l-2 border-amber-400/40';
  if (aiva.status === 'paused') return 'border-l-2 border-transparent opacity-70';
  return 'border-l-2 border-transparent';
}

function actionBadgeClass(actionType: string): string {
  if (actionType === 'escalated') return 'bg-red-500/15 text-red-400';
  if (actionType === 'automation_ran') return 'bg-blue-500/15 text-blue-400';
  if (actionType === 'message_sent' || actionType === 'message_received') return 'bg-gray-500/10 text-text-muted';
  return 'bg-overlay text-text-secondary';
}

function DrawerSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-text-muted">{title}</p>
      {children}
    </div>
  );
}

function SignalRow({
  sig,
  onAivaClick,
}: {
  sig: ScoutSignal;
  onAivaClick: (agentId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasMeta = sig.metadata && Object.keys(sig.metadata).length > 0;

  return (
    <>
      <tr
        className={[
          'group border-b border-border',
          sig.severity === 'critical' && 'border-l-2 border-red-500/40 bg-red-500/5',
          sig.severity === 'warning' && 'border-l-2 border-amber-400/30 bg-amber-500/5',
          sig.severity === 'info' && 'border-l-2 border-transparent',
          sig.isNew && 'bg-amber-500/10 transition-colors',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <td className="px-4 py-2.5 whitespace-nowrap text-text-muted">
          {new Date(sig.createdAt).toLocaleString()}
        </td>
        <td className="px-4 py-2.5">
          <SeverityBadge severity={sig.severity} />
        </td>
        <td className="px-4 py-2.5 font-mono text-text-muted">{sig.eventType}</td>
        <td className="px-4 py-2.5">
          <button
            type="button"
            onClick={() => onAivaClick(sig.agentId)}
            className="text-accent hover:underline"
          >
            {sig.agentName}
          </button>
        </td>
        <td className="px-4 py-2.5 text-text-secondary">{sig.workspaceName}</td>
        <td className="max-w-[200px] truncate px-4 py-2.5 text-text-secondary">{sig.summary}</td>
        <td className="px-2 py-2.5">
          {hasMeta ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-text-muted hover:text-text-primary"
              aria-label={expanded ? 'Collapse metadata' : 'Expand metadata'}
            >
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          ) : null}
        </td>
      </tr>
      {expanded && hasMeta ? (
        <tr className="border-b border-border bg-overlay/50">
          <td colSpan={7} className="px-4 py-2">
            <pre className="overflow-x-auto rounded border border-border bg-base p-2 font-mono text-[10px] text-text-secondary">
              {JSON.stringify(sig.metadata, null, 2)}
            </pre>
          </td>
        </tr>
      ) : null}
    </>
  );
}

export default function FleetPage() {
  const { push: toast } = useToast();
  const [tab, setTab] = useState<Tab>('aivas');
  const [aivas, setAivas] = useState<FleetAiva[]>([]);
  const [signals, setSignals] = useState<ScoutSignal[]>([]);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 350);
  const [status, setStatus] = useState('all');
  const [signalsOnly, setSignalsOnly] = useState(false);
  const [sort, setSort] = useState('escalation_rate_desc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successFlash, setSuccessFlash] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawer, setDrawer] = useState<FleetDetail | null>(null);
  const [pauseTarget, setPauseTarget] = useState<FleetAiva | null>(null);
  const [pauseReason, setPauseReason] = useState('');
  const [pauseError, setPauseError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [liveEnabled, setLiveEnabled] = useState(false);
  const [liveConnected, setLiveConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [criticalToasts, setCriticalToasts] = useState<CriticalToast[]>([]);
  const [severityFilter, setSeverityFilter] = useState('all');
  const [eventTypeFilter, setEventTypeFilter] = useState('all');
  const [aivaSearch, setAivaSearch] = useState('');
  const debouncedAivaSearch = useDebouncedValue(aivaSearch, 350);
  const [workspaceSearch, setWorkspaceSearch] = useState('');
  const debouncedWorkspaceSearch = useDebouncedValue(workspaceSearch, 350);
  const [dateSince, setDateSince] = useState('');
  const [signalsPage, setSignalsPage] = useState(1);
  const [signalsHasMore, setSignalsHasMore] = useState(false);
  const [signalsLoading, setSignalsLoading] = useState(false);
  const seenSignalIds = useRef(new Set<string>());

  const loadFleet = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (status !== 'all') params.set('status', status);
      if (signalsOnly) params.set('hasRecentSignals', 'true');
      params.set('sort', sort);
      const res = await fetch(`/api/admin/fleet?${params}`);
      const body = (await res.json()) as { aivas?: FleetAiva[]; error?: string };
      if (!res.ok) throw new Error(body.error ?? 'Failed to load fleet');
      setAivas(body.aivas ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load fleet';
      setError(message);
      toast(message, 'error');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, signalsOnly, sort, status, toast]);

  const loadSignals = useCallback(
    async (page = 1, append = false) => {
      setSignalsLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('limit', '50');
        params.set('page', String(page));
        if (severityFilter !== 'all') params.set('severity', severityFilter);
        if (eventTypeFilter !== 'all') params.set('eventType', eventTypeFilter);
        if (dateSince) params.set('since', new Date(dateSince).toISOString());
        const res = await fetch(`/api/admin/scout/signals?${params}`);
        const body = (await res.json()) as {
          signals?: ScoutSignal[];
          total?: number;
          page?: number;
          limit?: number;
        };
        if (!res.ok) return;
        const rows = body.signals ?? [];
        for (const sig of rows) seenSignalIds.current.add(sig.id);
        setSignals((prev) => (append ? [...prev, ...rows] : rows));
        const total = body.total ?? 0;
        const limit = body.limit ?? 50;
        setSignalsHasMore(page * limit < total);
        setSignalsPage(page);
      } catch {
        // non-fatal
      } finally {
        setSignalsLoading(false);
      }
    },
    [dateSince, eventTypeFilter, severityFilter],
  );

  const filteredSignals = useMemo(() => {
    return signals.filter((sig) => {
      if (debouncedAivaSearch && !sig.agentName.toLowerCase().includes(debouncedAivaSearch.toLowerCase())) {
        return false;
      }
      if (
        debouncedWorkspaceSearch &&
        !sig.workspaceName.toLowerCase().includes(debouncedWorkspaceSearch.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [debouncedAivaSearch, debouncedWorkspaceSearch, signals]);

  useEffect(() => {
    void loadFleet();
  }, [loadFleet]);

  useEffect(() => {
    void loadSignals(1, false);
  }, [loadSignals]);

  useEffect(() => {
    if (!liveEnabled) {
      setLiveConnected(false);
      setReconnecting(false);
      return;
    }

    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    function pushSignal(sig: ScoutSignal) {
      if (seenSignalIds.current.has(sig.id)) return;
      seenSignalIds.current.add(sig.id);
      const withNew: ScoutSignal = { ...sig, isNew: true };
      setSignals((prev) => [withNew, ...prev].slice(0, 300));
      setTimeout(() => {
        setSignals((prev) =>
          prev.map((row) => (row.id === sig.id ? { ...row, isNew: false } : row)),
        );
      }, 4000);

      if (sig.severity === 'critical') {
        setCriticalToasts((prev) => [
          ...prev,
          {
            id: sig.id,
            agentId: sig.agentId,
            agentName: sig.agentName,
            workspaceName: sig.workspaceName,
            eventType: sig.eventType,
            summary: sig.summary,
          },
        ]);
      }
    }

    function connect() {
      if (cancelled) return;
      setReconnecting(false);
      es = new EventSource('/api/admin/scout/signals/stream');
      es.onopen = () => setLiveConnected(true);
      es.onmessage = (e) => {
        try {
          pushSignal(JSON.parse(e.data) as ScoutSignal);
        } catch {
          // ignore
        }
      };
      es.onerror = () => {
        es?.close();
        setLiveConnected(false);
        if (!cancelled) {
          setReconnecting(true);
          reconnectTimer = setTimeout(connect, 3000);
        }
      };
    }

    connect();
    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      es?.close();
    };
  }, [liveEnabled]);

  async function openDrawerById(workerId: string) {
    setDrawerOpen(true);
    try {
      const res = await fetch(`/api/admin/fleet/${workerId}`);
      const body = (await res.json()) as FleetDetail & { error?: string };
      if (res.ok) setDrawer(body);
      else {
        toast(body.error ?? 'Failed to load Aiva detail', 'error');
        setDrawerOpen(false);
      }
    } catch {
      toast('Failed to load Aiva detail', 'error');
      setDrawerOpen(false);
    }
  }

  async function openDrawer(aiva: FleetAiva) {
    await openDrawerById(aiva.workerId);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setTimeout(() => setDrawer(null), 200);
  }

  async function confirmPause(resume = false) {
    if (!pauseTarget) return;
    setActionLoading(true);
    setPauseError('');
    try {
      const path = resume ? 'resume' : 'pause';
      const res = await fetch(`/api/admin/fleet/${pauseTarget.workerId}/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: pauseReason || 'Admin action' }),
      });
      const body = (await res.json()) as { error?: string; message?: string };
      if (res.status === 409 && body.error === 'workspace_suspended') {
        setPauseError(body.message ?? 'Resolve workspace billing before resuming this Aiva.');
        return;
      }
      if (!res.ok) throw new Error(body.message ?? body.error ?? 'Action failed');

      const target = pauseTarget;
      const newStatus = resume ? 'active' : 'paused';
      setAivas((prev) =>
        prev.map((a) => (a.workerId === target.workerId ? { ...a, status: newStatus } : a)),
      );

      if (resume) {
        setSuccessFlash(`${target.name} resumed`);
      } else {
        setSuccessFlash(`${target.name} paused`);
      }
      setTimeout(() => setSuccessFlash(''), 5000);

      toast(resume ? `${target.name} resumed` : `${target.name} paused`, 'success');
      setPauseTarget(null);
      setPauseReason('');
      if (drawer?.workerId === target.workerId) await openDrawerById(target.workerId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Action failed';
      setPauseError(message);
      toast(message, 'error');
    } finally {
      setActionLoading(false);
    }
  }

  const pauseIsResume = pauseTarget?.status === 'paused';

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Fleet</h1>
          <p className="mt-0.5 text-sm text-text-muted">Cross-workspace Aiva monitoring</p>
        </div>
        <Link href="/fleet/attestation" className="text-xs text-accent hover:underline">
          Attestation report
        </Link>
      </div>

      {successFlash ? (
        <div className="mb-3 rounded border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-400">
          {successFlash}
        </div>
      ) : null}
      {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}

      <div className="mb-4 flex gap-4 border-b border-border">
        {(['aivas', 'signals'] as Tab[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={[
              'border-b-2 px-3 py-2 text-sm capitalize',
              tab === key
                ? 'border-amber-400 font-medium text-text-primary'
                : 'border-transparent text-text-muted',
            ].join(' ')}
          >
            {key === 'aivas' ? 'Aivas' : 'Scout Signals'}
          </button>
        ))}
      </div>

      {tab === 'aivas' ? (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, role, workspace..."
              className="rounded border border-border bg-elevated px-3 py-2 text-sm text-text-primary"
            />
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              aria-label="Filter by status"
              className="rounded border border-border bg-elevated px-3 py-2 text-sm text-text-primary"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="error">Error</option>
              <option value="configuring">Configuring</option>
            </select>
            <select
              value={signalsOnly ? 'signals' : 'all'}
              onChange={(e) => setSignalsOnly(e.target.value === 'signals')}
              aria-label="Filter by recent signals"
              className="rounded border border-border bg-elevated px-3 py-2 text-sm text-text-primary"
            >
              <option value="all">All Aivas</option>
              <option value="signals">Signals in last 24h</option>
            </select>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              aria-label="Sort fleet list"
              className="rounded border border-border bg-elevated px-3 py-2 text-sm text-text-primary"
            >
              <option value="escalation_rate_desc">Sort: escalation rate</option>
              <option value="last_active_desc">Sort: last active</option>
              <option value="created_at_desc">Sort: created</option>
            </select>
          </div>

          {loading ? (
            <TableSkeleton rows={8} cols={7} />
          ) : (
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-overlay text-[11px] text-text-muted">
                    <th className="px-4 py-2.5 text-left font-medium">Aiva</th>
                    <th className="px-4 py-2.5 text-left font-medium">Workspace</th>
                    <th className="px-4 py-2.5 text-left font-medium">Status</th>
                    <th className="px-4 py-2.5 text-left font-medium">Esc</th>
                    <th className="px-4 py-2.5 text-left font-medium">Signals 24h</th>
                    <th className="px-4 py-2.5 text-left font-medium">Attestation</th>
                    <th className="w-28" />
                  </tr>
                </thead>
                <tbody>
                  {aivas.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-text-muted">
                        No Aivas match your filters.
                      </td>
                    </tr>
                  ) : (
                    aivas.map((aiva) => (
                      <tr
                        key={aiva.workerId}
                        className={['group border-b border-border', rowBorder(aiva)].join(' ')}
                      >
                        <td className="px-4 py-3">
                          <p className="font-medium text-text-primary">{aiva.name}</p>
                          <p className="max-w-[140px] truncate text-[11px] text-text-muted">{aiva.role}</p>
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/customers/${aiva.workspaceId}`}
                            className="font-medium text-accent hover:underline"
                          >
                            {aiva.workspaceName}
                          </Link>
                          <p className="text-[11px] text-text-muted">{aiva.ownerEmail ?? '-'}</p>
                        </td>
                        <td className="px-4 py-3">
                          <AivaStatusDot status={aiva.status} />
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={
                              aiva.escalationRate > 0.2 ? 'font-medium text-red-400' : 'text-text-muted'
                            }
                          >
                            {aiva.escalationCount}
                            {aiva.escalationRate > 0.2 ? ' [!]' : ''}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {aiva.recentSignalCount === 0 ? (
                            <span className="text-text-muted">-</span>
                          ) : (
                            <span
                              className={
                                aiva.highestRecentSeverity === 'critical'
                                  ? 'font-medium text-red-400'
                                  : 'text-amber-400'
                              }
                            >
                              {aiva.recentSignalCount}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <AttestationCell coverage={aiva.attestationCoverage} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                            <button
                              type="button"
                              onClick={() => {
                                setPauseTarget(aiva);
                                setPauseReason('');
                                setPauseError('');
                              }}
                              className="text-[11px] text-amber-400 hover:underline"
                            >
                              {aiva.status === 'paused' ? 'Resume' : 'Pause'}
                            </button>
                            <button
                              type="button"
                              onClick={() => void openDrawer(aiva)}
                              className="text-[11px] text-accent hover:underline"
                            >
                              View
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              aria-label="Filter by severity"
              className="rounded border border-border bg-elevated px-2 py-1.5 text-xs text-text-primary"
            >
              <option value="all">All severities</option>
              <option value="critical">Critical</option>
              <option value="warning">Warning</option>
              <option value="info">Info</option>
            </select>
            <select
              value={eventTypeFilter}
              onChange={(e) => setEventTypeFilter(e.target.value)}
              aria-label="Filter by event type"
              className="rounded border border-border bg-elevated px-2 py-1.5 text-xs text-text-primary"
            >
              <option value="all">All event types</option>
              <option value="escalation_burst">escalation_burst</option>
              <option value="high_escalation_rate">high_escalation_rate</option>
              <option value="volume_spike">volume_spike</option>
              <option value="unauthorized_tool_attempt">unauthorized_tool_attempt</option>
              <option value="tool_failure_loop">tool_failure_loop</option>
            </select>
            <input
              value={aivaSearch}
              onChange={(e) => setAivaSearch(e.target.value)}
              placeholder="Aiva name..."
              className="rounded border border-border bg-elevated px-2 py-1.5 text-xs text-text-primary"
            />
            <input
              value={workspaceSearch}
              onChange={(e) => setWorkspaceSearch(e.target.value)}
              placeholder="Workspace..."
              className="rounded border border-border bg-elevated px-2 py-1.5 text-xs text-text-primary"
            />
            <input
              type="date"
              value={dateSince}
              onChange={(e) => setDateSince(e.target.value)}
              aria-label="Filter signals since date"
              className="rounded border border-border bg-elevated px-2 py-1.5 text-xs text-text-primary"
            />
            <div className="ml-auto flex items-center gap-2">
              <LiveIndicator connected={liveConnected} reconnecting={reconnecting} />
              <button
                type="button"
                role="switch"
                aria-checked={liveEnabled ? 'true' : 'false'}
                aria-label="Toggle live signal feed"
                onClick={() => setLiveEnabled((v) => !v)}
                className={[
                  'relative inline-flex h-5 w-9 rounded-full transition-colors',
                  liveEnabled ? 'bg-green-500/60' : 'bg-overlay',
                ].join(' ')}
              >
                <span
                  className={[
                    'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform',
                    liveEnabled ? 'translate-x-4' : 'translate-x-0.5',
                  ].join(' ')}
                />
              </button>
              <span className="text-xs text-text-muted">Live</span>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-overlay text-[11px] text-text-muted">
                  <th className="px-4 py-2.5 text-left font-medium">Time</th>
                  <th className="px-4 py-2.5 text-left font-medium">Severity</th>
                  <th className="px-4 py-2.5 text-left font-medium">Event type</th>
                  <th className="px-4 py-2.5 text-left font-medium">Aiva</th>
                  <th className="px-4 py-2.5 text-left font-medium">Workspace</th>
                  <th className="px-4 py-2.5 text-left font-medium">Summary</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {filteredSignals.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-text-muted">
                      {signalsLoading ? 'Loading signals...' : 'No signals match your filters.'}
                    </td>
                  </tr>
                ) : (
                  filteredSignals.map((sig) => (
                    <SignalRow
                      key={sig.id}
                      sig={sig}
                      onAivaClick={(id) => void openDrawerById(id)}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
          {signalsHasMore ? (
            <button
              type="button"
              disabled={signalsLoading}
              onClick={() => void loadSignals(signalsPage + 1, true)}
              className="mt-3 text-xs text-accent hover:underline disabled:opacity-50"
            >
              {signalsLoading ? 'Loading...' : 'Load more'}
            </button>
          ) : null}
        </>
      )}

      <Modal
        open={Boolean(pauseTarget)}
        onClose={() => {
          setPauseTarget(null);
          setPauseError('');
        }}
        title={pauseTarget ? `${pauseIsResume ? 'Resume' : 'Pause'} ${pauseTarget.name}?` : ''}
        description={
          pauseTarget
            ? `Workspace: ${pauseTarget.workspaceName}. This affects live conversations immediately.`
            : undefined
        }
        footer={
          <>
            <button
              type="button"
              onClick={() => {
                setPauseTarget(null);
                setPauseError('');
              }}
              className="px-4 py-2 text-sm text-text-muted"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={actionLoading || (!pauseIsResume && pauseReason.length < 3)}
              onClick={() => void confirmPause(pauseIsResume)}
              className="rounded bg-red-500/20 px-4 py-2 text-sm text-red-400"
            >
              {actionLoading ? 'Working...' : pauseIsResume ? 'Resume' : 'Pause Aiva'}
            </button>
          </>
        }
      >
        {pauseError ? <p className="mb-3 text-sm text-red-400">{pauseError}</p> : null}
        {!pauseIsResume ? (
          <input
            value={pauseReason}
            onChange={(e) => setPauseReason(e.target.value)}
            placeholder="Reason (required for pause)"
            className="w-full rounded border border-border bg-base px-3 py-2 text-sm text-text-primary"
          />
        ) : null}
      </Modal>

      {drawerOpen ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/40"
            onClick={closeDrawer}
            aria-label="Close drawer"
          />
          <div
            className={[
              'fixed top-10 right-0 bottom-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-elevated transition-transform duration-200',
              drawerOpen ? 'translate-x-0' : 'translate-x-full',
            ].join(' ')}
          >
            {drawer ? (
              <>
                <div className="flex shrink-0 items-start justify-between border-b border-border p-4">
                  <div>
                    <h2 className="text-base font-semibold text-text-primary">{drawer.name}</h2>
                    <p className="text-xs text-text-muted">{drawer.role}</p>
                    <p className="mt-1 text-[11px] text-text-muted">{drawer.workspaceName}</p>
                  </div>
                  <button type="button" onClick={closeDrawer} aria-label="Close">
                    <X className="h-4 w-4 text-text-muted" />
                  </button>
                </div>

                <div className="grid shrink-0 grid-cols-4 gap-2 border-b border-border p-4 text-center text-xs">
                  <div>
                    <p className="text-lg font-semibold">{drawer.totalMessages}</p>
                    <p className="text-[10px] text-text-muted">Msgs</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold">{drawer.escalationCount}</p>
                    <p className="text-[10px] text-text-muted">Esc</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold">
                      <AttestationCell coverage={drawer.attestationCoverage} />
                    </p>
                    <p className="text-[10px] text-text-muted">Attest</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold">{drawer.recentSignalCount}</p>
                    <p className="text-[10px] text-text-muted">Signals</p>
                  </div>
                </div>

                <div className="flex-1 space-y-5 overflow-y-auto p-4 text-xs">
                  <DrawerSection title="Channels">
                    {(drawer.channels ?? []).length === 0 ? (
                      <p className="text-text-muted">No channels configured.</p>
                    ) : (
                      <ul className="space-y-1">
                        {(drawer.channels ?? []).map((ch) => (
                          <li key={`${ch.channel}-${ch.identifier}`} className="flex justify-between">
                            <span className="capitalize text-text-secondary">{ch.channel}</span>
                            <span className="font-mono text-text-muted">
                              {maskIdentifier(ch.identifier, ch.channel)}
                              {!ch.enabled ? ' (off)' : ''}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </DrawerSection>

                  <DrawerSection title="Automations">
                    {(drawer.automations ?? []).length === 0 ? (
                      <p className="text-text-muted">No automations.</p>
                    ) : (
                      <ul className="space-y-1">
                        {(drawer.automations ?? []).map((auto) => (
                          <li key={auto.id} className="flex justify-between gap-2">
                            <span className="text-text-secondary">{auto.name}</span>
                            <span className="text-text-muted">
                              {auto.scheduleLabel || 'manual'}
                              {!auto.enabled ? ' (off)' : ''}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </DrawerSection>

                  <DrawerSection title="Recent activity">
                    {(drawer.recentActivity ?? []).slice(0, 10).map((item) => (
                      <div key={item.id} className="flex items-start gap-2 border-b border-border py-1.5">
                        <span
                          className={[
                            'shrink-0 rounded px-1 py-0.5 text-[9px] font-semibold uppercase',
                            actionBadgeClass(item.actionType),
                          ].join(' ')}
                        >
                          {item.actionType.replace(/_/g, ' ')}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-text-secondary">{item.summary}</p>
                          <p className="text-[10px] text-text-muted">{timeAgo(item.createdAt)}</p>
                        </div>
                        <span className="shrink-0 text-[10px] text-text-muted">
                          {item.attestationTx ? 'On-chain' : 'Pending'}
                        </span>
                      </div>
                    ))}
                  </DrawerSection>

                  <DrawerSection title="Scout signals">
                    {(drawer.recentSignals ?? []).length === 0 ? (
                      <p className="text-text-muted">No recent signals.</p>
                    ) : (
                      (drawer.recentSignals ?? []).map((sig) => (
                        <div
                          key={sig.id}
                          className={[
                            'border-b border-border py-1.5',
                            sig.severity === 'critical' && 'rounded bg-red-500/5 px-2',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                        >
                          <div className="flex items-center gap-2">
                            <SeverityBadge severity={sig.severity} />
                            <span className="font-mono text-[10px] text-text-muted">{sig.eventType}</span>
                          </div>
                          <p className="mt-0.5 text-text-secondary">{sig.summary}</p>
                        </div>
                      ))
                    )}
                  </DrawerSection>
                </div>

                <div className="flex shrink-0 items-center justify-between border-t border-border p-4">
                  <button
                    type="button"
                    onClick={() => {
                      setPauseTarget(drawer);
                      setPauseReason('');
                      setPauseError('');
                    }}
                    className="text-xs text-red-400 hover:underline"
                  >
                    {drawer.status === 'paused' ? 'Resume Aiva' : 'Kill switch: pause'}
                  </button>
                  <Link href={`/customers/${drawer.workspaceId}`} className="text-xs text-accent hover:underline">
                    Open customer page
                  </Link>
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center text-sm text-text-muted">Loading...</div>
            )}
          </div>
        </>
      ) : null}

      <CriticalSignalToasts
        toasts={criticalToasts}
        onDismiss={(id) => setCriticalToasts((prev) => prev.filter((t) => t.id !== id))}
        onView={(agentId) => {
          void openDrawerById(agentId);
          setCriticalToasts((prev) => prev.filter((t) => t.agentId !== agentId));
        }}
      />
    </div>
  );
}
