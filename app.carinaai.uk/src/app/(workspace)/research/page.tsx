'use client';

import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle,
  Clock,
  Download,
  ExternalLink,
  FileText,
  Globe,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  XCircle,
} from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/button';
import { MarkdownContent } from '@/components/chat/MarkdownContent';
import { cn } from '@/lib/utils';

type ResearchStatus = 'queued' | 'running' | 'completed' | 'failed';

interface ResearchJob {
  id: string;
  query: string;
  mode: string;
  status: ResearchStatus;
  rounds: number;
  output: string | null;
  sources: unknown;
  error: string | null;
  createdAt: string;
}

interface ResearchSource {
  url: string;
  title: string;
  snippet: string;
}

const MODE_DESCRIPTIONS: Record<string, string> = {
  auto: 'Let Carina decide the best research approach',
  product: 'Research a product, company, or service',
  compare: 'Compare two or more options side by side',
  'how-to': 'Find step-by-step guidance or instructions',
  'fact-check': 'Verify a claim against multiple sources',
};

const STATUS_ICON: Record<ResearchStatus, ReactNode> = {
  queued: <Clock className="h-4 w-4 text-text-muted" />,
  running: <Loader2 className="h-4 w-4 animate-spin text-accent" />,
  completed: <CheckCircle className="h-4 w-4 text-emerald-400" />,
  failed: <XCircle className="h-4 w-4 text-danger" />,
};

function parseSources(raw: unknown): ResearchSource[] {
  if (!raw) return [];
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((source) => ({
        url: String(source?.url ?? ''),
        title: String(source?.title ?? source?.url ?? 'Untitled source'),
        snippet: String(source?.snippet ?? ''),
      }))
      .filter((source) => source.url);
  } catch {
    return [];
  }
}

function formatDate(value: string) {
  return new Date(value).toLocaleString([], {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function downloadMarkdown(job: ResearchJob) {
  const content = [
    `# Research: ${job.query}`,
    '',
    `Mode: ${job.mode}`,
    `Rounds: ${job.rounds}`,
    `Date: ${new Date(job.createdAt).toLocaleString()}`,
    '',
    '---',
    '',
    job.output ?? 'No output',
  ].join('\n');
  const blob = new Blob([content], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `research-${job.id.slice(0, 8)}.md`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function ResearchPage() {
  const [jobs, setJobs] = useState<ResearchJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState('auto');
  const [rounds, setRounds] = useState(3);
  const [submitting, setSubmitting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const activeJob = useMemo(
    () => jobs.find((job) => job.id === activeJobId) ?? jobs[0] ?? null,
    [activeJobId, jobs],
  );
  const sources = parseSources(activeJob?.sources);

  async function loadJobs() {
    setLoading(true);
    const response = await fetch('/api/research');
    const data = await response.json();
    if (data.data) {
      setJobs(data.data);
      setActiveJobId((current) => current ?? data.data[0]?.id ?? null);
    }
    setLoading(false);
  }

  useEffect(() => {
    void loadJobs();
  }, []);

  useEffect(() => {
    const runningIds = jobs
      .filter((job) => job.status === 'queued' || job.status === 'running')
      .map((job) => job.id);

    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (runningIds.length === 0) return;

    pollRef.current = setInterval(() => {
      runningIds.forEach((id) => {
        void fetch(`/api/research/${id}`)
          .then((response) => response.json())
          .then((data) => {
            if (!data.data) return;
            setJobs((current) => current.map((job) => (job.id === id ? data.data : job)));
          });
      });
    }, 3000);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [jobs.map((job) => `${job.id}:${job.status}`).join('|')]);

  async function submitResearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 5) return;

    setSubmitting(true);
    const response = await fetch('/api/research', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: trimmedQuery, mode, rounds }),
    });
    const data = await response.json();
    if (data.data) {
      setJobs((current) => [data.data, ...current]);
      setActiveJobId(data.data.id);
      setQuery('');
      setShowForm(false);
    }
    setSubmitting(false);
  }

  async function deleteJob(job: ResearchJob) {
    if (!window.confirm('Delete this research report?')) return;
    await fetch(`/api/research/${job.id}`, { method: 'DELETE' });
    setJobs((current) => current.filter((item) => item.id !== job.id));
    if (activeJobId === job.id) setActiveJobId(null);
  }

  return (
    <div className="flex h-full bg-base">
      <aside className="flex w-[21rem] shrink-0 flex-col overflow-hidden border-r border-border max-lg:w-72">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h1 className="text-sm font-semibold text-text-primary">Research</h1>
            <p className="mt-0.5 text-[11px] text-text-muted">Deep search and synthesis jobs</p>
          </div>
          <Button type="button" size="sm" onClick={() => setShowForm((current) => !current)}>
            <Plus className="h-3.5 w-3.5" />
            New
          </Button>
        </div>

        {showForm && (
          <form onSubmit={(event) => void submitResearch(event)} className="space-y-3 border-b border-border bg-surface p-4">
            <textarea
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="What do you want to research?"
              rows={4}
              autoFocus
              className="w-full resize-none rounded-md border border-border bg-elevated px-3 py-2 text-xs leading-5 text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent"
            />

            <div>
              <p className="mb-1.5 text-[11px] font-medium text-text-muted">Mode</p>
              <div className="space-y-1">
                {Object.entries(MODE_DESCRIPTIONS).map(([itemMode, description]) => (
                  <button
                    key={itemMode}
                    type="button"
                    onClick={() => setMode(itemMode)}
                    className={cn(
                      'flex w-full items-start gap-2 rounded-md border px-2.5 py-2 text-left transition-colors',
                      mode === itemMode
                        ? 'border-accent/40 bg-accent/10'
                        : 'border-border bg-elevated hover:bg-overlay',
                    )}
                  >
                    <span className="mt-0.5 w-16 shrink-0 text-[11px] font-medium capitalize text-text-primary">
                      {itemMode}
                    </span>
                    <span className="text-[11px] leading-4 text-text-muted">{description}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between text-[11px] text-text-muted">
                <span>Research rounds</span>
                <span className="font-medium text-text-secondary">{rounds}</span>
              </div>
              <input
                type="range"
                min={1}
                max={10}
                value={rounds}
                onChange={(event) => setRounds(Number(event.target.value))}
                className="w-full accent-green-500"
              />
              <div className="flex justify-between text-[10px] text-text-muted">
                <span>1 quick</span>
                <span>10 deep</span>
              </div>
            </div>

            <Button type="submit" size="sm" disabled={submitting || query.trim().length < 5} className="w-full">
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
              {submitting ? 'Starting' : `Start research (${rounds} rounds)`}
            </Button>
          </form>
        )}

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center gap-2 border-b border-border px-4 py-2">
            <span className="text-[11px] font-medium uppercase tracking-wide text-text-muted">Recent jobs</span>
            <IconButton label="Refresh research" size="sm" className="ml-auto" onClick={() => void loadJobs()}>
              <RefreshCw className="h-3.5 w-3.5" />
            </IconButton>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-10">
                <Spinner />
              </div>
            ) : jobs.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <p className="text-xs text-text-muted">No research yet</p>
                <p className="mt-1 text-[11px] text-text-muted">Create a job to start a multi-step search.</p>
              </div>
            ) : (
              jobs.map((job) => (
                <button
                  key={job.id}
                  type="button"
                  onClick={() => setActiveJobId(job.id)}
                  className={cn(
                    'flex w-full items-start gap-3 border-b border-border px-4 py-3 text-left transition-colors hover:bg-surface',
                    activeJob?.id === job.id && 'bg-surface',
                  )}
                >
                  <span className="mt-0.5 shrink-0">{STATUS_ICON[job.status]}</span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-xs leading-5 text-text-primary">{job.query}</span>
                    <span className="mt-1 flex items-center gap-2 text-[10px] text-text-muted">
                      <span className="capitalize">{job.mode}</span>
                      <span>{job.rounds} rounds</span>
                      <span className="ml-auto">{new Date(job.createdAt).toLocaleDateString()}</span>
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {!activeJob ? (
          <div className="flex flex-1 items-center justify-center">
            <EmptyState
              icon={<Search className="h-8 w-8" />}
              title="No research selected"
              subtitle="Select an existing report or start a new research job."
              action={
                <Button type="button" size="sm" onClick={() => setShowForm(true)}>
                  <Plus className="h-3.5 w-3.5" />
                  New research
                </Button>
              }
            />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
              <div className="flex min-w-0 items-center gap-3">
                {STATUS_ICON[activeJob.status]}
                <div className="min-w-0">
                  <h2 className="line-clamp-1 text-sm font-semibold leading-tight text-text-primary">
                    {activeJob.query}
                  </h2>
                  <p className="mt-0.5 text-[11px] capitalize text-text-muted">
                    {activeJob.mode} / {activeJob.rounds} rounds / {formatDate(activeJob.createdAt)}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {activeJob.status === 'completed' && (
                  <Button type="button" variant="outline" size="sm" onClick={() => downloadMarkdown(activeJob)}>
                    <Download className="h-3.5 w-3.5" />
                    Export
                  </Button>
                )}
                <IconButton label="Delete report" size="sm" onClick={() => void deleteJob(activeJob)}>
                  <Trash2 className="h-3.5 w-3.5 text-danger" />
                </IconButton>
              </div>
            </div>

            {(activeJob.status === 'queued' || activeJob.status === 'running') && (
              <div className="flex items-center gap-3 border-b border-border bg-surface px-6 py-3">
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-accent" />
                <p className="text-xs text-text-secondary">
                  {activeJob.status === 'queued'
                    ? 'Research queued. It will start shortly.'
                    : `Running ${activeJob.rounds} rounds of web research.`}
                </p>
              </div>
            )}

            {activeJob.status === 'failed' && (
              <div className="border-b border-border bg-danger/10 px-6 py-3">
                <p className="text-xs text-danger">Research failed: {activeJob.error ?? 'Unknown error'}</p>
              </div>
            )}

            <div className="flex min-h-0 flex-1 overflow-hidden">
              <section className="min-w-0 flex-1 overflow-y-auto px-6 py-5">
                {activeJob.status === 'completed' && activeJob.output ? (
                  <div className="mx-auto max-w-4xl">
                    <MarkdownContent content={activeJob.output} />
                  </div>
                ) : activeJob.status === 'queued' || activeJob.status === 'running' ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-accent" />
                    <p className="text-xs text-text-muted">Carina is researching.</p>
                    <p className="text-[11px] text-text-muted">Results will appear here when complete.</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-3 py-20">
                    <FileText className="h-8 w-8 text-text-muted" />
                    <p className="text-xs text-text-muted">No output available.</p>
                  </div>
                )}
              </section>

              {sources.length > 0 && (
                <aside className="w-72 shrink-0 overflow-y-auto border-l border-border bg-surface">
                  <div className="border-b border-border px-4 py-3">
                    <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                      <Globe className="h-3 w-3" />
                      Sources ({sources.length})
                    </p>
                  </div>
                  <div className="divide-y divide-border">
                    {sources.map((source) => (
                      <a
                        key={source.url}
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block px-4 py-3 transition-colors hover:bg-elevated"
                      >
                        <span className="flex items-start gap-2">
                          <span className="line-clamp-2 text-xs leading-5 text-text-primary">{source.title}</span>
                          <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-text-muted" />
                        </span>
                        <span className="mt-1 block truncate text-[10px] text-text-muted">{source.url}</span>
                        {source.snippet && (
                          <span className="mt-1 line-clamp-2 block text-[11px] leading-4 text-text-muted">
                            {source.snippet}
                          </span>
                        )}
                      </a>
                    ))}
                  </div>
                </aside>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
