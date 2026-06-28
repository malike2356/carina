'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  Clock3,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCw,
  Save,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/EmptyState';
import { CarinaEditor } from '@/components/editor';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type JobStatus = 'active' | 'paused' | 'completed' | 'removed';

type CronJob = {
  id: string;
  name: string | null;
  schedule: string;
  prompt: string | null;
  status: JobStatus;
  lastRun: string | null;
  nextRun: string | null;
  deliver: string;
  profileName: string;
  scriptPath: string | null;
  noAgent: boolean;
  contextFrom: string[];
  chainAfter: string[];
  enabledToolsets: string[];
  workdir: string | null;
  deliverChannels: string[];
  modelProvider: string | null;
  modelName: string | null;
  repeatCount: number | null;
  runsRemaining: number | null;
  failureLimit: number | null;
  failureCount: number;
  createdAt: string;
};

type CronRun = {
  id: string;
  jobId: string;
  output: string;
  success: boolean;
  completedAt: string;
};

type CronFormState = {
  id: string;
  name: string;
  schedule: string;
  prompt: string;
  deliver: string;
  deliverChannels: string;
  profileName: string;
  scriptPath: string;
  noAgent: boolean;
  contextFrom: string;
  chainAfter: string;
  enabledToolsets: string;
  workdir: string;
  modelProvider: string;
  modelName: string;
  repeatCount: string;
  runsRemaining: string;
  failureLimit: string;
};

const EMPTY_FORM: CronFormState = {
  id: '',
  name: '',
  schedule: '0 9 * * *',
  prompt: '',
  deliver: 'origin',
  deliverChannels: '',
  profileName: 'default',
  scriptPath: '',
  noAgent: false,
  contextFrom: '',
  chainAfter: '',
  enabledToolsets: '',
  workdir: '',
  modelProvider: '',
  modelName: '',
  repeatCount: '',
  runsRemaining: '',
  failureLimit: '3',
};

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatTime(value: string | null): string {
  if (!value) return 'Never';
  return new Date(value).toLocaleString();
}

function describeSchedule(schedule: string): string {
  const text = schedule.trim();
  if (!text) return 'No schedule';
  if (text === '0 9 * * *') return 'Every day at 9:00 AM';
  if (text === '0 */1 * * *' || text === '0 * * * *') return 'Every hour';
  if (text === '*/30 * * * *') return 'Every 30 minutes';
  if (text.startsWith('0 9 * * 1')) return 'Every Monday at 9:00 AM';
  return text;
}

function schedulePreset(schedule: string): string {
  const text = schedule.trim();
  if (text === '*/30 * * * *') return 'every-30';
  if (text === '0 * * * *' || text === '0 */1 * * *') return 'hourly';
  if (text === '0 9 * * *') return 'daily-9';
  if (text === '0 9 * * 1') return 'weekly-mon-9';
  return 'custom';
}

function statusClass(status: JobStatus): string {
  if (status === 'active') return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30';
  if (status === 'paused') return 'bg-amber-500/10 text-amber-300 border-amber-500/30';
  if (status === 'completed') return 'bg-accent/10 text-accent border-accent/30';
  return 'bg-border text-text-muted border-border';
}

function badgeClass(success: boolean): string {
  return success ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' : 'bg-danger/10 text-danger border-danger/30';
}

function toForm(job: CronJob): CronFormState {
  return {
    id: job.id,
    name: job.name ?? '',
    schedule: job.schedule,
    prompt: job.prompt ?? '',
    deliver: job.deliver || 'origin',
    deliverChannels: job.deliverChannels.join(', '),
    profileName: job.profileName || 'default',
    scriptPath: job.scriptPath ?? '',
    noAgent: job.noAgent,
    contextFrom: job.contextFrom.join(', '),
    chainAfter: job.chainAfter.join(', '),
    enabledToolsets: job.enabledToolsets.join(', '),
    workdir: job.workdir ?? '',
    modelProvider: job.modelProvider ?? '',
    modelName: job.modelName ?? '',
    repeatCount: job.repeatCount != null ? String(job.repeatCount) : '',
    runsRemaining: job.runsRemaining != null ? String(job.runsRemaining) : '',
    failureLimit: job.failureLimit != null ? String(job.failureLimit) : '3',
  };
}

export function CronPage() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [history, setHistory] = useState<CronRun[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState<CronFormState>(EMPTY_FORM);

  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === selectedId) ?? null,
    [jobs, selectedId],
  );

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/cron', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Unable to load cron jobs');
      const next = (data.jobs ?? []) as CronJob[];
      setJobs(next);
      if (selectedId && !next.some((job) => job.id === selectedId)) {
        setSelectedId(next[0]?.id ?? '');
      } else if (!selectedId) {
        setSelectedId(next[0]?.id ?? '');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setJobs([]);
      setSelectedId('');
    } finally {
      setLoading(false);
    }
  }

  async function loadHistory(jobId: string) {
    if (!jobId) {
      setHistory([]);
      return;
    }
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/cron/${encodeURIComponent(jobId)}/history?limit=12`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Unable to load job history');
      setHistory((data.history ?? []) as CronRun[]);
    } catch (err) {
      setHistory([]);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (selectedJob) {
      setForm(toForm(selectedJob));
      void loadHistory(selectedJob.id);
    } else {
      setForm(EMPTY_FORM);
      setHistory([]);
    }
  }, [selectedJob?.id]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    const method = form.id ? 'PUT' : 'POST';
    const endpoint = form.id ? `/api/cron/${encodeURIComponent(form.id)}` : '/api/cron';
    try {
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim() || null,
          schedule: form.schedule.trim(),
          prompt: form.prompt.trim() || null,
          deliver: form.deliver.trim() || 'origin',
          deliverChannels: splitList(form.deliverChannels),
          profileName: form.profileName.trim() || 'default',
          scriptPath: form.scriptPath.trim() || null,
          noAgent: form.noAgent,
          contextFrom: splitList(form.contextFrom),
          chainAfter: splitList(form.chainAfter),
          enabledToolsets: splitList(form.enabledToolsets),
          workdir: form.workdir.trim() || null,
          modelProvider: form.modelProvider.trim() || null,
          modelName: form.modelName.trim() || null,
          repeatCount: form.repeatCount.trim() ? Number(form.repeatCount) : null,
          runsRemaining: form.runsRemaining.trim() ? Number(form.runsRemaining) : null,
          failureLimit: form.failureLimit.trim() ? Number(form.failureLimit) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Unable to save cron job');
      await load();
      if (data.job?.id) {
        setSelectedId(data.job.id);
        setForm(toForm(data.job as CronJob));
        await loadHistory(data.job.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(job: CronJob) {
    setError('');
    const endpoint = job.status === 'active'
      ? `/api/cron/${encodeURIComponent(job.id)}/pause`
      : `/api/cron/${encodeURIComponent(job.id)}/resume`;
    const res = await fetch(endpoint, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? 'Unable to update job');
      return;
    }
    await load();
    if (selectedId === job.id) {
      await loadHistory(job.id);
    }
  }

  async function runNow(job: CronJob) {
    setRunning(job.id);
    setError('');
    try {
      const res = await fetch(`/api/cron/${encodeURIComponent(job.id)}/run`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Unable to run job');
      await load();
      await loadHistory(job.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(null);
    }
  }

  async function remove(job: CronJob) {
    if (!window.confirm(`Delete "${job.name ?? job.id}"?`)) return;
    setError('');
    const res = await fetch(`/api/cron/${encodeURIComponent(job.id)}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? 'Unable to delete job');
      return;
    }
    await load();
  }

  const activeCount = jobs.filter((job) => job.status === 'active').length;
  const pausedCount = jobs.filter((job) => job.status === 'paused').length;
  const completedCount = jobs.filter((job) => job.status === 'completed').length;

  return (
    <div className="flex h-full min-h-0 flex-col bg-base">
      <header className="border-b border-border px-6 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold text-text-primary">Cron</h1>
            <p className="text-xs text-text-muted">
              Schedule recurring jobs, run them now, and inspect recent history.
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
              onClick={() => {
                setSelectedId('');
                setForm(EMPTY_FORM);
                setHistory([]);
              }}
              className="inline-flex items-center gap-2 rounded-md bg-accent px-3 py-2 text-xs font-medium text-white"
            >
              <Plus className="h-3.5 w-3.5" />
              New job
            </button>
          </div>
        </div>
        {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)] gap-0 max-xl:grid-cols-1">
        <section className="min-h-0 border-r border-border">
          <div className="grid gap-3 border-b border-border px-6 py-4 sm:grid-cols-3">
            {[
              { label: 'Active jobs', value: activeCount },
              { label: 'Paused jobs', value: pausedCount },
              { label: 'Completed jobs', value: completedCount },
            ].map((card) => (
              <div key={card.label} className="rounded-lg border border-border bg-surface px-4 py-3">
                <p className="text-[10px] uppercase tracking-wide text-text-muted">{card.label}</p>
                <p className="mt-1 text-2xl font-semibold text-text-primary">{card.value}</p>
              </div>
            ))}
          </div>

          <div className="min-h-0 overflow-y-auto px-6 py-5">
            {loading ? (
              <EmptyState title="Loading cron jobs" subtitle="Pulling scheduled jobs from the core scheduler." />
            ) : jobs.length === 0 ? (
              <EmptyState
                icon={<CalendarClock className="h-7 w-7" />}
                title="No cron jobs yet"
                subtitle="Create a schedule from the form on the right."
              />
            ) : (
              <div className="space-y-3">
                {jobs.map((job) => {
                  const active = job.id === selectedId;
                  return (
                    <article
                      key={job.id}
                      className={cn(
                        'rounded-lg border bg-surface p-4 transition-colors',
                        active ? 'border-accent/40 ring-1 ring-accent/30' : 'border-border hover:border-border/80',
                      )}
                    >
                      <div className="flex flex-wrap items-start gap-3">
                        <button
                          type="button"
                          onClick={() => setSelectedId(job.id)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="truncate text-sm font-semibold text-text-primary">
                              {job.name ?? job.id.slice(0, 8)}
                            </h2>
                            <span className={cn('rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide', statusClass(job.status))}>
                              {job.status}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-text-muted">{describeSchedule(job.schedule)}</p>
                          <p className="mt-1 text-xs text-text-secondary">
                            Next run: {formatTime(job.nextRun)}
                          </p>
                          <div className="mt-3 grid gap-2 text-xs text-text-muted sm:grid-cols-3">
                            <span>Last run: {formatTime(job.lastRun)}</span>
                            <span>Deliver: {job.deliver}</span>
                            <span>Profile: {job.profileName}</span>
                          </div>
                          {job.prompt ? (
                            <p className="mt-3 line-clamp-2 text-sm text-text-secondary">{job.prompt}</p>
                          ) : null}
                        </button>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button type="button" variant="outline" size="sm" onClick={() => void toggleStatus(job)}>
                            {job.status === 'active' ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                            {job.status === 'active' ? 'Pause' : 'Resume'}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void runNow(job)}
                            disabled={running === job.id}
                          >
                            <RotateCw className="h-3.5 w-3.5" />
                            Run now
                          </Button>
                          <Button type="button" variant="outline" size="sm" onClick={() => setSelectedId(job.id)}>
                            Edit
                          </Button>
                          <Button type="button" variant="destructive" size="sm" onClick={() => void remove(job)}>
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <aside className="min-h-0 overflow-y-auto">
          <form onSubmit={(event) => void save(event)} className="flex min-h-full flex-col gap-5 px-6 py-5">
            <section className="rounded-lg border border-border bg-surface p-4">
              <div className="mb-3 flex items-center gap-2">
                <Save className="h-4 w-4 text-accent" />
                <h2 className="text-sm font-semibold text-text-primary">{form.id ? 'Edit job' : 'Create job'}</h2>
              </div>
              <div className="grid gap-3">
                <Input
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Job name"
                />
                <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <Input
                    value={form.schedule}
                    onChange={(event) => setForm((current) => ({ ...current, schedule: event.target.value }))}
                    placeholder="0 9 * * *"
                  />
                  <select
                    value={schedulePreset(form.schedule)}
                    onChange={(event) => {
                      const next = event.target.value;
                      const preset =
                        next === 'every-30' ? '*/30 * * * *' :
                        next === 'hourly' ? '0 * * * *' :
                        next === 'daily-9' ? '0 9 * * *' :
                        next === 'weekly-mon-9' ? '0 9 * * 1' :
                        form.schedule;
                      setForm((current) => ({ ...current, schedule: preset }));
                    }}
                    className="rounded-md border border-border bg-elevated px-3 py-2 text-sm text-text-secondary"
                  >
                    <option value="custom">Custom</option>
                    <option value="every-30">Every 30 minutes</option>
                    <option value="hourly">Every hour</option>
                    <option value="daily-9">Daily at 9:00 AM</option>
                    <option value="weekly-mon-9">Weekly Monday at 9:00 AM</option>
                  </select>
                </div>
                <p className="text-[11px] text-text-muted">
                  Next run preview: {describeSchedule(form.schedule)}
                </p>
                <CarinaEditor
                  value={form.prompt}
                  onChange={(prompt) => setForm((current) => ({ ...current, prompt }))}
                  placeholder="Instructions for the job"
                  variant="compact"
                  minHeight="8rem"
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    value={form.deliver}
                    onChange={(event) => setForm((current) => ({ ...current, deliver: event.target.value }))}
                    placeholder="origin"
                  />
                  <Input
                    value={form.deliverChannels}
                    onChange={(event) => setForm((current) => ({ ...current, deliverChannels: event.target.value }))}
                    placeholder="Optional delivery channels"
                  />
                </div>
                <p className="text-[11px] text-text-muted">
                  Delivery stays honest: use `origin`, `local`, `all`, or an explicit channel list. Script packaging and advanced routing still live in the CLI path.
                </p>
                <Input
                  value={form.profileName}
                  onChange={(event) => setForm((current) => ({ ...current, profileName: event.target.value }))}
                  placeholder="default"
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex items-center gap-2 text-xs text-text-secondary">
                    <input
                      type="checkbox"
                      checked={form.noAgent}
                      onChange={(event) => setForm((current) => ({ ...current, noAgent: event.target.checked }))}
                    />
                    Script only
                  </label>
                  <Input
                    value={form.scriptPath}
                    onChange={(event) => setForm((current) => ({ ...current, scriptPath: event.target.value }))}
                    placeholder="Script path"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    value={form.workdir}
                    onChange={(event) => setForm((current) => ({ ...current, workdir: event.target.value }))}
                    placeholder="Working directory"
                  />
                  <Input
                    value={form.modelProvider}
                    onChange={(event) => setForm((current) => ({ ...current, modelProvider: event.target.value }))}
                    placeholder="Model provider"
                  />
                </div>
                <Input
                  value={form.modelName}
                  onChange={(event) => setForm((current) => ({ ...current, modelName: event.target.value }))}
                  placeholder="Model name"
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    value={form.contextFrom}
                    onChange={(event) => setForm((current) => ({ ...current, contextFrom: event.target.value }))}
                    placeholder="Context from job ids"
                  />
                  <Input
                    value={form.chainAfter}
                    onChange={(event) => setForm((current) => ({ ...current, chainAfter: event.target.value }))}
                    placeholder="Chain after job ids"
                  />
                </div>
                <Input
                  value={form.enabledToolsets}
                  onChange={(event) => setForm((current) => ({ ...current, enabledToolsets: event.target.value }))}
                  placeholder="Enabled toolsets"
                />
                <div className="grid gap-3 sm:grid-cols-3">
                  <Input
                    value={form.repeatCount}
                    onChange={(event) => setForm((current) => ({ ...current, repeatCount: event.target.value }))}
                    placeholder="Repeat count"
                    type="number"
                  />
                  <Input
                    value={form.runsRemaining}
                    onChange={(event) => setForm((current) => ({ ...current, runsRemaining: event.target.value }))}
                    placeholder="Runs remaining"
                    type="number"
                  />
                  <Input
                    value={form.failureLimit}
                    onChange={(event) => setForm((current) => ({ ...current, failureLimit: event.target.value }))}
                    placeholder="Failure limit"
                    type="number"
                  />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <Button type="submit" disabled={saving}>
                  <Save className="h-3.5 w-3.5" />
                  {saving ? 'Saving' : form.id ? 'Update job' : 'Create job'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSelectedId('');
                    setForm(EMPTY_FORM);
                    setHistory([]);
                  }}
                >
                  New form
                </Button>
              </div>
            </section>

            <section className="rounded-lg border border-border bg-surface p-4">
              <div className="mb-3 flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-accent" />
                <h2 className="text-sm font-semibold text-text-primary">Recent runs</h2>
              </div>
              {historyLoading ? (
                <EmptyState title="Loading history" subtitle="Pulling the latest runs for this job." />
              ) : history.length === 0 ? (
                <EmptyState
                  title="No run history"
                  subtitle="Run the job once to populate history."
                />
              ) : (
                <div className="space-y-2">
                  {history.map((run) => (
                    <article key={run.id} className="rounded-md border border-border bg-elevated px-3 py-3">
                      <div className="flex flex-wrap items-center gap-2 text-[11px]">
                        <span className={cn('rounded-full border px-2 py-0.5 uppercase tracking-wide', badgeClass(run.success))}>
                          {run.success ? 'Succeeded' : 'Failed'}
                        </span>
                        <span className="text-text-muted">{formatTime(run.completedAt)}</span>
                      </div>
                      <p className="mt-2 line-clamp-4 text-sm text-text-secondary">{run.output || 'No output'}</p>
                    </article>
                  ))}
                </div>
              )}
            </section>

            {selectedJob ? (
              <section className="rounded-lg border border-border bg-surface p-4">
                <div className="mb-3 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-accent" />
                  <h2 className="text-sm font-semibold text-text-primary">Selected job</h2>
                </div>
                <dl className="grid gap-2 text-xs text-text-secondary">
                  <div className="flex justify-between gap-3">
                    <dt>Status</dt>
                    <dd className="text-text-primary">{selectedJob.status}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>Last run</dt>
                    <dd className="text-text-primary">{formatTime(selectedJob.lastRun)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>Next run</dt>
                    <dd className="text-text-primary">{formatTime(selectedJob.nextRun)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>Failure count</dt>
                    <dd className="text-text-primary">{selectedJob.failureCount}</dd>
                  </div>
                </dl>
              </section>
            ) : null}
          </form>
        </aside>
      </div>
    </div>
  );
}
