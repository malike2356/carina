'use client';

import { X } from 'lucide-react';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  formatMinutes,
  KanbanColumn,
  LoadBar,
  PriorityBadge,
  ScoutSignalsSection,
  SlaKpiCard,
  SlaStatPill,
  SlaTracker,
  sortEscalations,
  type EscalationCardData,
} from '@/components/va/VaQueueUi';
import { VaReplyPanel } from '@/components/va/VaReplyPanel';
import { VaTeamSetupWizard } from '@/components/va/VaTeamSetupWizard';
import { ChartSkeleton, KanbanSkeleton, Skeleton, TableSkeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { useDebouncedValue } from '@/lib/use-debounced-value';

type VaTab = 'queue' | 'team' | 'sla';

interface QueueCounts {
  unassigned: number;
  in_progress: number;
  resolved_today: number;
  urgent: number;
  sla_breached: number;
}

interface EscalationSummary extends EscalationCardData {
  resolvedAt?: string | null;
  conversationContext?: Array<{ role: string; content: string }>;
  workerChannels?: Array<{ channel: string; identifier: string }>;
  channel?: {
    type: string;
    identifier: string | null;
    displayLabel: string;
  };
  scoutSignals?: Array<{ id: string; eventType: string; severity: string; summary: string }>;
  slaResolutionTarget?: string | null;
}

interface VaTeamMember {
  id: string;
  name: string;
  email: string;
  available: boolean;
  currentLoad: number;
  maxLoad: number;
  resolvedLast30d: number;
  avgResolutionMinutes: number | null;
}

interface SlaMetrics {
  totalEscalations: number;
  breachedCount: number;
  breachRate: number;
  avgMinutesToFirstResponse: number;
  avgMinutesToResolution: number;
  firstResponseSlaRate: number;
  resolutionSlaRate: number;
  byPriority: Array<{ priority: string; count: number; slaRate: number }>;
  byVaMember: Array<{ id: string; name: string; assigned: number; resolved: number; slaRate: number }>;
  timeline: Array<{ date: string; received: number; resolved: number; breached: number }>;
}

function isResolvedToday(resolvedAt?: string | null): boolean {
  if (!resolvedAt) return false;
  const d = new Date(resolvedAt);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function columnKey(item: EscalationSummary): 'unassigned' | 'in_progress' | 'resolved_today' {
  if (item.status === 'resolved' && isResolvedToday(item.resolvedAt)) return 'resolved_today';
  if (item.status === 'in_progress' || (item.status === 'open' && item.assignedTo)) {
    return 'in_progress';
  }
  if (item.status === 'open') return 'unassigned';
  return 'in_progress';
}

export default function VaQueuePage() {
  const { push: toast } = useToast();
  const [tab, setTab] = useState<VaTab>('queue');
  const [items, setItems] = useState<EscalationSummary[]>([]);
  const [counts, setCounts] = useState<QueueCounts>({
    unassigned: 0,
    in_progress: 0,
    resolved_today: 0,
    urgent: 0,
    sla_breached: 0,
  });
  const [team, setTeam] = useState<VaTeamMember[]>([]);
  const [teamLoading, setTeamLoading] = useState(true);
  const [sla, setSla] = useState<SlaMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [slaLoading, setSlaLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<EscalationSummary | null>(null);
  const [assignTo, setAssignTo] = useState('');
  const [resolutionNote, setResolutionNote] = useState('');
  const [resolving, setResolving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newMaxLoad, setNewMaxLoad] = useState('5');
  const [removeErrors, setRemoveErrors] = useState<Record<string, string>>({});

  const availableMembers = useMemo(
    () => team.filter((m) => m.available && m.currentLoad < m.maxLoad),
    [team],
  );

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/va/queue?status=all&limit=200');
      const body = (await res.json()) as {
        escalations?: EscalationSummary[];
        counts?: QueueCounts;
        error?: string;
      };
      if (!res.ok) throw new Error(body.error ?? 'Failed to load VA queue');
      setItems(body.escalations ?? []);
      if (body.counts) setCounts(body.counts);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load VA queue';
      setError(message);
      toast(message, 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadTeam = useCallback(async () => {
    setTeamLoading(true);
    try {
      const res = await fetch('/api/admin/va/team');
      if (res.ok) {
        const body = (await res.json()) as { members?: VaTeamMember[] };
        setTeam(body.members ?? []);
      }
    } finally {
      setTeamLoading(false);
    }
  }, []);

  const loadSla = useCallback(async () => {
    setSlaLoading(true);
    try {
      const res = await fetch('/api/admin/va/sla');
      if (res.ok) setSla((await res.json()) as SlaMetrics);
    } finally {
      setSlaLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadQueue();
    void loadTeam();
    void loadSla();
  }, [loadQueue, loadTeam, loadSla]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setAssignTo('');
      setResolutionNote('');
      return;
    }
    let cancelled = false;
    async function loadDetail() {
      const res = await fetch(`/api/admin/va/queue/${selectedId}`);
      const body = (await res.json()) as EscalationSummary & { error?: string };
      if (!cancelled && res.ok) {
        setDetail(body);
        setAssignTo(body.assignedTo?.id ?? '');
      }
    }
    void loadDetail();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const filteredItems = useMemo(() => {
    if (!debouncedSearch) return items;
    const q = debouncedSearch.toLowerCase();
    return items.filter((item) =>
      [item.workerName, item.workspaceName, item.reason, item.assignedTo?.name]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [debouncedSearch, items]);

  const grouped = useMemo(() => {
    const buckets = {
      unassigned: [] as EscalationSummary[],
      in_progress: [] as EscalationSummary[],
      resolved_today: [] as EscalationSummary[],
    };
    for (const item of filteredItems) {
      const key = columnKey(item);
      if (key === 'resolved_today' || item.status !== 'resolved' || isResolvedToday(item.resolvedAt)) {
        buckets[key].push(item);
      }
    }
    return {
      unassigned: sortEscalations(buckets.unassigned),
      in_progress: sortEscalations(buckets.in_progress),
      resolved_today: sortEscalations(buckets.resolved_today),
    };
  }, [filteredItems]);

  const avgMinutesWaiting = useMemo(() => {
    const open = items.filter((i) => i.status !== 'resolved');
    if (open.length === 0) return 0;
    return Math.round(
      open.reduce((sum, i) => sum + (i.minutesWaiting ?? 0), 0) / open.length,
    );
  }, [items]);

  async function handleAssign(escalationId?: string, memberId?: string) {
    const id = escalationId ?? selectedId;
    const targetMember = memberId ?? assignTo;
    if (!id || !targetMember) return;
    const member = team.find((m) => m.id === targetMember);
    const res = await fetch(`/api/admin/va/queue/${id}/assign`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignedTo: targetMember }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      toast(body.error ?? 'Assign failed', 'error');
      return;
    }
    setItems((prev) =>
      prev.map((i) =>
        i.id === id
          ? {
              ...i,
              status: 'in_progress',
              assignedTo: { id: targetMember, name: member?.name ?? targetMember },
            }
          : i,
      ),
    );
    toast('Escalation assigned', 'success');
    void loadTeam();
    if (selectedId === id) {
      const detailRes = await fetch(`/api/admin/va/queue/${id}`);
      if (detailRes.ok) setDetail((await detailRes.json()) as EscalationSummary);
    }
  }

  async function handleMoveStage(
    escalationId: string,
    status: 'open' | 'in_progress' | 'resolved',
  ) {
    const previous = items;
    const now = new Date().toISOString();
    setItems((prev) =>
      prev.map((item) =>
        item.id === escalationId
          ? {
              ...item,
              status,
              firstResponseAt:
                status === 'in_progress' ? item.firstResponseAt ?? now : item.firstResponseAt,
              resolvedAt: status === 'resolved' ? item.resolvedAt ?? now : null,
            }
          : item,
      ),
    );
    const res = await fetch(`/api/admin/va/queue/${escalationId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setItems(previous);
      toast(body.error ?? 'Status update failed', 'error');
      return;
    }
    toast('Escalation moved', 'success');
    void loadQueue();
    void loadTeam();
    void loadSla();
    if (selectedId === escalationId) {
      const detailRes = await fetch(`/api/admin/va/queue/${escalationId}`);
      if (detailRes.ok) setDetail((await detailRes.json()) as EscalationSummary);
    }
  }

  async function markFirstResponse() {
    if (!selectedId || detail?.firstResponseAt) return;
    const res = await fetch(`/api/admin/va/queue/${selectedId}/first-response`, { method: 'PATCH' });
    if (!res.ok) {
      toast('Could not mark first response', 'error');
      return;
    }
    toast('First response recorded', 'success');
    const now = new Date().toISOString();
    setDetail((d) => (d ? { ...d, firstResponseAt: now } : d));
    void loadQueue();
  }

  async function handleReplySent(result: { handedBack: boolean; channel: string }) {
    if (!selectedId || !detail) return;
    const now = new Date().toISOString();
    setDetail((d) => {
      if (!d) return d;
      return {
        ...d,
        firstResponseAt: d.firstResponseAt ?? now,
        status: result.handedBack ? 'resolved' : 'in_progress',
        resolvedAt: result.handedBack ? now : d.resolvedAt,
      };
    });
    setItems((prev) =>
      prev.map((i) =>
        i.id === selectedId
          ? {
              ...i,
              firstResponseAt: i.firstResponseAt ?? now,
              status: result.handedBack ? 'resolved' : 'in_progress',
              resolvedAt: result.handedBack ? now : i.resolvedAt,
            }
          : i,
      ),
    );
    void loadQueue();
    void loadTeam();
    if (result.handedBack) void loadSla();
  }

  async function handleResolve() {
    if (!selectedId || resolutionNote.trim().length < 10) return;
    setResolving(true);
    try {
      const res = await fetch(`/api/admin/va/queue/${selectedId}/resolve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolutionNote: resolutionNote.trim() }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? 'Resolve failed');
      toast('Escalation resolved', 'success');
      setSelectedId(null);
      void loadQueue();
      void loadTeam();
      void loadSla();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Resolve failed', 'error');
    } finally {
      setResolving(false);
    }
  }

  async function handleAddMember() {
    if (!newName.trim() || !newEmail.trim()) return;
    const res = await fetch('/api/admin/va/team', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newName.trim(),
        email: newEmail.trim(),
        maxLoad: parseInt(newMaxLoad, 10) || 5,
      }),
    });
    if (!res.ok) {
      const body = (await res.json()) as { error?: string };
      toast(body.error ?? 'Failed to add member', 'error');
      return;
    }
    setShowAddForm(false);
    setNewName('');
    setNewEmail('');
    setNewMaxLoad('5');
    void loadTeam();
    toast('Team member added', 'success');
  }

  async function toggleAvailable(memberId: string, available: boolean) {
    setTeam((prev) => prev.map((m) => (m.id === memberId ? { ...m, available } : m)));
    const res = await fetch(`/api/admin/va/team/${memberId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ available }),
    });
    if (!res.ok) void loadTeam();
  }

  async function removeMember(memberId: string, name: string) {
    if (!window.confirm(`Remove ${name} from the VA team?`)) return;
    const res = await fetch(`/api/admin/va/team/${memberId}`, { method: 'DELETE' });
    const body = (await res.json()) as { error?: string; count?: number };
    if (res.status === 409) {
      setRemoveErrors((prev) => ({
        ...prev,
        [memberId]: `Has ${body.count ?? 'open'} open escalations. Reassign first.`,
      }));
      return;
    }
    if (!res.ok) {
      toast(body.error ?? 'Remove failed', 'error');
      return;
    }
    setRemoveErrors((prev) => {
      const next = { ...prev };
      delete next[memberId];
      return next;
    });
    void loadTeam();
    toast('Team member removed', 'success');
  }

  const totalOpen = counts.unassigned + counts.in_progress;

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col overflow-hidden">
      <div className="mb-4 shrink-0">
        <h1 className="text-2xl font-semibold text-text-primary">VA Queue</h1>
        <p className="mt-0.5 text-sm text-text-muted">Escalated conversations and team operations</p>
      </div>

      {tab === 'queue' ? (
        <div className="mb-4 flex flex-wrap items-center gap-3 text-xs">
          <SlaStatPill label="Total open" value={totalOpen} />
          <SlaStatPill
            label="SLA breached"
            value={counts.sla_breached}
            danger={counts.sla_breached > 0}
          />
          <SlaStatPill label="Urgent" value={counts.urgent} danger={counts.urgent > 0} />
          <SlaStatPill label="Avg wait" value={`${avgMinutesWaiting}m`} />
          <SlaStatPill
            label="Avg TTFR 30d"
            value={sla ? `${sla.avgMinutesToFirstResponse}m` : '-'}
          />
          <SlaStatPill
            label="Avg TTR 30d"
            value={sla ? `${sla.avgMinutesToResolution}m` : '-'}
          />
        </div>
      ) : null}

      <div className="mb-4 flex shrink-0 gap-4 border-b border-border">
        {(['queue', 'team', 'sla'] as VaTab[]).map((key) => (
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
            {key === 'sla' ? 'SLA report' : key}
          </button>
        ))}
      </div>

      {error ? <p className="mb-3 shrink-0 text-sm text-danger">{error}</p> : null}

      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === 'queue' ? (
          <>
            <div className="mb-4 shrink-0">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search worker, workspace, reason..."
                className="w-full max-w-sm rounded border border-border bg-elevated px-3 py-2 text-sm text-text-primary"
              />
            </div>
            {loading ? (
              <KanbanSkeleton />
            ) : (
              <div className="grid h-full grid-cols-1 gap-4 lg:grid-cols-3">
                <KanbanColumn
                  title="Unassigned"
                  stage="open"
                  count={grouped.unassigned.length}
                  breachCount={grouped.unassigned.filter((e) => e.slaBreached).length}
                  escalations={grouped.unassigned}
                  onView={setSelectedId}
                  onQuickAssign={(id, memberId) => void handleAssign(id, memberId)}
                  onMoveStage={(id, status) => void handleMoveStage(id, status)}
                  availableMembers={availableMembers}
                />
                <KanbanColumn
                  title="In Progress"
                  stage="in_progress"
                  count={grouped.in_progress.length}
                  breachCount={grouped.in_progress.filter((e) => e.slaBreached).length}
                  escalations={grouped.in_progress}
                  onView={setSelectedId}
                  onQuickAssign={(id, memberId) => void handleAssign(id, memberId)}
                  onMoveStage={(id, status) => void handleMoveStage(id, status)}
                  availableMembers={availableMembers}
                />
                <KanbanColumn
                  title="Resolved Today"
                  stage="resolved"
                  count={grouped.resolved_today.length}
                  breachCount={0}
                  escalations={grouped.resolved_today}
                  onView={setSelectedId}
                  onQuickAssign={(id, memberId) => void handleAssign(id, memberId)}
                  onMoveStage={(id, status) => void handleMoveStage(id, status)}
                  availableMembers={availableMembers}
                />
              </div>
            )}
          </>
        ) : null}

        {tab === 'team' ? (
          <div className="overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-medium text-text-primary">VA team</h2>
              <button
                type="button"
                onClick={() => setShowAddForm(true)}
                className="rounded bg-amber-500/20 px-3 py-1.5 text-xs text-amber-300"
              >
                + Add team member
              </button>
            </div>
            {showAddForm ? (
              <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-overlay p-3">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Name"
                  className="rounded border border-border bg-base px-2 py-1 text-xs text-text-primary"
                />
                <input
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="Email"
                  className="rounded border border-border bg-base px-2 py-1 text-xs text-text-primary"
                />
                <input
                  value={newMaxLoad}
                  type="number"
                  min={1}
                  max={20}
                  onChange={(e) => setNewMaxLoad(e.target.value)}
                  placeholder="Max load"
                  className="w-20 rounded border border-border bg-base px-2 py-1 text-xs text-text-primary"
                />
                <button
                  type="button"
                  onClick={() => void handleAddMember()}
                  className="rounded bg-amber-500/20 px-2 py-1 text-xs text-amber-300"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="text-xs text-text-muted hover:text-text-primary"
                >
                  Cancel
                </button>
              </div>
            ) : null}
            {team.length === 0 && teamLoading ? (
              <TableSkeleton rows={5} cols={8} />
            ) : team.length === 0 && !showAddForm ? (
              <VaTeamSetupWizard onComplete={() => { void loadTeam(); }} />
            ) : (
              <div className="overflow-hidden rounded-lg border border-border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-overlay text-[11px] text-text-muted">
                      <th className="px-4 py-2.5 text-left font-medium">Name</th>
                      <th className="px-4 py-2.5 text-left font-medium">Email</th>
                      <th className="px-4 py-2.5 text-left font-medium">Available</th>
                      <th className="px-4 py-2.5 text-left font-medium">Open</th>
                      <th className="px-4 py-2.5 text-left font-medium">Load</th>
                      <th className="px-4 py-2.5 text-left font-medium">Resolved 30d</th>
                      <th className="px-4 py-2.5 text-left font-medium">Avg TTR</th>
                      <th className="w-16" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {team.map((member) => (
                        <Fragment key={member.id}>
                          <tr className={member.available ? '' : 'opacity-60'}>
                            <td className="px-4 py-2.5 font-medium text-text-primary">{member.name}</td>
                            <td className="px-4 py-2.5 text-text-muted">{member.email}</td>
                            <td className="px-4 py-2.5">
                              <input
                                type="checkbox"
                                checked={member.available}
                                onChange={(e) => void toggleAvailable(member.id, e.target.checked)}
                                aria-label={`Toggle availability for ${member.name}`}
                              />
                            </td>
                            <td className="px-4 py-2.5 text-text-muted">{member.currentLoad}</td>
                            <td className="px-4 py-2.5">
                              <LoadBar current={member.currentLoad} max={member.maxLoad} />
                            </td>
                            <td className="px-4 py-2.5 text-text-muted">{member.resolvedLast30d}</td>
                            <td className="px-4 py-2.5 text-text-muted">
                              {member.avgResolutionMinutes != null
                                ? formatMinutes(member.avgResolutionMinutes)
                                : '-'}
                            </td>
                            <td className="px-4 py-2.5">
                              <button
                                type="button"
                                onClick={() => void removeMember(member.id, member.name)}
                                className="text-[11px] text-red-400 hover:underline"
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                          {removeErrors[member.id] ? (
                            <tr>
                              <td colSpan={8} className="px-4 pb-2 text-xs text-danger">
                                {removeErrors[member.id]}
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}

        {tab === 'sla' ? (
          slaLoading || !sla ? (
            <div className="space-y-6 overflow-y-auto">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="rounded-lg border border-border bg-elevated p-4">
                    <Skeleton className="mb-2 h-3 w-20" />
                    <Skeleton className="h-6 w-16" />
                  </div>
                ))}
              </div>
              <ChartSkeleton />
            </div>
          ) : (
            <div className="space-y-6 overflow-y-auto pb-6">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <SlaKpiCard
                  label="First response SLA"
                  value={`${(sla.firstResponseSlaRate * 100).toFixed(0)}%`}
                  sub="target: 100% in 15 min"
                  good={sla.firstResponseSlaRate >= 0.9}
                />
                <SlaKpiCard
                  label="Resolution SLA"
                  value={`${(sla.resolutionSlaRate * 100).toFixed(0)}%`}
                  sub="target: 100% in 4h"
                  good={sla.resolutionSlaRate >= 0.9}
                />
                <SlaKpiCard
                  label="Breach rate"
                  value={`${(sla.breachRate * 100).toFixed(1)}%`}
                  sub={`${sla.breachedCount} of ${sla.totalEscalations}`}
                  good={sla.breachRate < 0.1}
                />
                <SlaKpiCard
                  label="Avg TTR"
                  value={`${sla.avgMinutesToResolution}m`}
                  sub="last 30 days"
                  good={sla.avgMinutesToResolution <= 240}
                />
              </div>
              <div className="rounded-lg border border-border bg-elevated p-4">
                <h2 className="mb-4 text-sm font-semibold text-text-primary">Daily volume</h2>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={sla.timeline}>
                      <XAxis dataKey="date" tick={{ fontSize: 9 }} stroke="#666" />
                      <YAxis tick={{ fontSize: 10 }} stroke="#666" />
                      <Tooltip />
                      <Bar dataKey="received" fill="#f59e0b" name="Received" isAnimationActive={false} />
                      <Bar dataKey="resolved" fill="#22c55e" name="Resolved" isAnimationActive={false} />
                      <Bar dataKey="breached" fill="#ef4444" name="Breached" isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="overflow-hidden rounded-lg border border-border">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border bg-overlay text-[11px] text-text-muted">
                        <th className="px-4 py-2.5 text-left">VA member</th>
                        <th className="px-4 py-2.5 text-left">Assigned</th>
                        <th className="px-4 py-2.5 text-left">Resolved</th>
                        <th className="px-4 py-2.5 text-left">SLA rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sla.byVaMember.map((row) => (
                        <tr key={row.id} className="border-b border-border">
                          <td className="px-4 py-3 text-text-primary">{row.name}</td>
                          <td className="px-4 py-3 text-text-muted">{row.assigned}</td>
                          <td className="px-4 py-3 text-text-muted">{row.resolved}</td>
                          <td className="px-4 py-3 text-text-muted">
                            {(row.slaRate * 100).toFixed(0)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="overflow-hidden rounded-lg border border-border">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border bg-overlay text-[11px] text-text-muted">
                        <th className="px-4 py-2.5 text-left">Priority</th>
                        <th className="px-4 py-2.5 text-left">Count</th>
                        <th className="px-4 py-2.5 text-left">SLA rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sla.byPriority.map((row) => (
                        <tr key={row.priority} className="border-b border-border">
                          <td className="px-4 py-3 capitalize text-text-primary">{row.priority}</td>
                          <td className="px-4 py-3 text-text-muted">{row.count}</td>
                          <td className="px-4 py-3 text-text-muted">
                            {(row.slaRate * 100).toFixed(0)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )
        ) : null}
      </div>

      {selectedId ? (
        <button
          type="button"
          aria-label="Close detail panel"
          className="fixed inset-0 top-10 z-40 bg-black/40"
          onClick={() => setSelectedId(null)}
        />
      ) : null}

      <div
        className={[
          'fixed top-10 right-0 bottom-0 z-50 flex w-full max-w-[560px] flex-col border-l border-border bg-elevated transition-transform duration-200',
          selectedId ? 'translate-x-0' : 'translate-x-full',
        ].join(' ')}
      >
        {detail ? (
          <>
            <div className="flex shrink-0 items-start justify-between border-b border-border p-4">
              <div>
                <div className="mb-0.5 flex items-center gap-2">
                  {detail.priority !== 'normal' ? <PriorityBadge priority={detail.priority} /> : null}
                  <h2 className="text-base font-semibold text-text-primary">
                    {detail.workerName} - {detail.workspaceName}
                  </h2>
                </div>
                <p className="text-xs text-text-muted">
                  Escalated via {detail.workerChannels?.[0]?.channel ?? 'unknown channel'}
                  {' · '}
                  {formatMinutes(detail.minutesWaiting ?? 0)} ago
                </p>
                {detail.slaBreached ? (
                  <p className="mt-0.5 text-xs font-medium text-red-400">SLA breached</p>
                ) : null}
              </div>
              <button type="button" onClick={() => setSelectedId(null)} aria-label="Close">
                <X className="h-4 w-4 text-text-muted" />
              </button>
            </div>

            <div className="shrink-0 border-b border-border bg-overlay px-4 py-3">
              <div className="grid grid-cols-2 gap-4">
                <SlaTracker
                  label="First response"
                  target={detail.slaFirstResponseTarget}
                  achieved={detail.firstResponseAt}
                />
                <SlaTracker
                  label="Resolution"
                  target={detail.slaResolutionTarget}
                  achieved={detail.resolvedAt}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="border-b border-border p-4">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                  Conversation
                </p>
                <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-border p-3">
                  {(detail.conversationContext ?? []).map((msg, i) => (
                    <div
                      key={i}
                      className={[
                        'rounded-lg px-3 py-2 text-[11px]',
                        msg.role === 'user'
                          ? 'ml-8 bg-accent-dim text-right text-text-primary'
                          : 'mr-8 border border-border text-text-secondary',
                      ].join(' ')}
                    >
                      {msg.content}
                    </div>
                  ))}
                  <div className="my-2 border-t border-red-500/20 pt-2 text-center text-[10px] text-red-400">
                    Aiva escalated here - reason: &quot;{detail.reason}&quot;
                  </div>
                </div>
              </div>

              {detail.status !== 'resolved' ? (
                <VaReplyPanel
                  escalationId={detail.id}
                  channel={detail.channel ?? null}
                  onSent={handleReplySent}
                />
              ) : null}

              {detail.status !== 'resolved' ? (
                <>
                  <div className="border-b border-border p-4">
                    <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                      Assignment
                    </p>
                    <div className="mb-3 flex items-center gap-3">
                      <select
                        value={assignTo}
                        onChange={(e) => setAssignTo(e.target.value)}
                        aria-label="Assign to team member"
                        className="flex-1 rounded border border-border bg-base px-2 py-1.5 text-xs text-text-primary"
                      >
                        <option value="">Unassigned</option>
                        {availableMembers.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} ({m.currentLoad}/{m.maxLoad})
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={!assignTo || assignTo === detail.assignedTo?.id}
                        onClick={() => void handleAssign()}
                        className="rounded bg-amber-500/20 px-3 py-1.5 text-xs text-amber-300 disabled:opacity-50"
                      >
                        Assign
                      </button>
                    </div>
                    <button
                      type="button"
                      disabled={Boolean(detail.firstResponseAt)}
                      onClick={() => void markFirstResponse()}
                      className={[
                        'w-full rounded border py-1.5 text-xs transition-colors',
                        detail.firstResponseAt
                          ? 'cursor-default border-border text-text-muted opacity-40'
                          : 'border-amber-500/30 text-amber-400 hover:bg-amber-500/10',
                      ].join(' ')}
                    >
                      {detail.firstResponseAt ? 'First response recorded' : 'Mark first response'}
                    </button>
                  </div>

                  <div className="border-b border-border p-4">
                    <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                      Resolution
                    </p>
                    <textarea
                      value={resolutionNote}
                      onChange={(e) => setResolutionNote(e.target.value)}
                      rows={3}
                      placeholder="Describe how this was resolved (min 10 characters)"
                      className="admin-input mb-2 w-full text-xs"
                    />
                    <button
                      type="button"
                      disabled={resolutionNote.length < 10 || resolving}
                      onClick={() => void handleResolve()}
                      className="btn-admin-primary w-full text-xs disabled:opacity-50"
                    >
                      {resolving ? 'Resolving...' : 'Mark resolved'}
                    </button>
                  </div>
                </>
              ) : null}

              <ScoutSignalsSection
                workerName={detail.workerName}
                signals={detail.scoutSignals ?? []}
              />
            </div>
          </>
        ) : selectedId ? (
          <div className="flex flex-1 items-center justify-center text-sm text-text-muted">
            Loading...
          </div>
        ) : null}
      </div>
    </div>
  );
}
