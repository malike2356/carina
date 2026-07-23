'use client';

import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle,
  Clock,
  Download,
  ExternalLink,
  FileText,
  Globe,
  Loader2,
  MessageSquare,
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
import { CarinaEditor } from '@/components/editor';
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
    `Depth rounds: ${job.rounds}`,
    `Date: ${new Date(job.createdAt).toLocaleString()}`,
    '',
    '---',
    '',
    job.output ?? 'No output',
  ].join('\n');
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `research-${job.id.slice(0, 8)}.md`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function downloadHtml(job: ResearchJob) {
  const body = (job.output ?? 'No output')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Research: ${job.query.replace(/</g, '')}</title>
  <style>
    body { font-family: Georgia, serif; max-width: 720px; margin: 40px auto; padding: 0 20px; line-height: 1.6; color: #111; }
    pre { white-space: pre-wrap; font-family: Georgia, serif; }
    h1 { font-size: 1.6rem; }
  </style>
</head>
<body>
  <h1>Research: ${job.query.replace(/</g, '')}</h1>
  <p><small>Mode: ${job.mode} / Depth rounds: ${job.rounds} / ${new Date(job.createdAt).toLocaleString()}</small></p>
  <hr />
  <pre>${body}</pre>
</body>
</html>`;
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `research-${job.id.slice(0, 8)}.html`;
  anchor.click();
  URL.revokeObjectURL(url);
}

const DEPTH_PRESETS = [
  { id: 'quick', label: 'Quick', rounds: 3, hint: '~5 questions, ~12 sources' },
  { id: 'standard', label: 'Standard', rounds: 6, hint: '~8 questions, ~24 sources' },
  { id: 'deep', label: 'Deep', rounds: 9, hint: '~12 questions, ~48 sources' },
] as const;

export default function ResearchPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<ResearchJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState('auto');
  const [rounds, setRounds] = useState(6);
  const [submitting, setSubmitting] = useState(false);
  const [savingDoc, setSavingDoc] = useState(false);
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
    }, 2000);

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

  async function discussInChat(job: ResearchJob) {
    const response = await fetch(`/api/research/${job.id}/discuss`, { method: 'POST' });
    const data = await response.json();
    if (data.data?.sessionId) {
      router.push(`/chat/${data.data.sessionId}?researchJob=${job.id}`);
    }
  }

  async function saveAsDocument(job: ResearchJob) {
    if (!job.output?.trim()) return;
    setSavingDoc(true);
    try {
      const title = `Research: ${job.query}`.slice(0, 120);
      const response = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content: [
            `# ${title}`,
            '',
            `Mode: ${job.mode}`,
            `Depth rounds: ${job.rounds}`,
            `Date: ${new Date(job.createdAt).toLocaleString()}`,
            '',
            '---',
            '',
            job.output,
          ].join('\n'),
          format: 'markdown',
        }),
      });
      const data = await response.json();
      if (data.data?.id) {
        router.push(`/documents/${data.data.id}`);
        return;
      }
      window.alert(data.error ?? 'Could not save document');
    } catch {
      window.alert('Could not save document');
    } finally {
      setSavingDoc(false);
    }
  }

  const activeDepth = DEPTH_PRESETS.find((item) => item.rounds === rounds)?.id
    ?? (rounds <= 3 ? 'quick' : rounds <= 6 ? 'standard' : 'deep');

  return (
    <div className="flex h-auto min-h-full min-w-0 flex-col overflow-y-auto bg-base lg:h-full lg:min-h-0 lg:flex-row lg:overflow-hidden">
      <aside className="flex w-full min-w-0 shrink-0 flex-col overflow-visible border-b border-border lg:max-h-none lg:w-[21rem] lg:overflow-hidden lg:border-b-0 lg:border-r">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h1 className="text-sm font-semibold text-text-primary">Research</h1>
            <p className="mt-0.5 text-[11px] text-text-muted">Deep search and synthesis jobs</p>
          </div>
          <Button type="button" size="sm" onClick={() => setShowForm((current) => !current)} className="shrink-0">
            <Plus className="h-3.5 w-3.5" />
            New
          </Button>
        </div>

        {showForm && (
          <form onSubmit={(event) => void submitResearch(event)} className="space-y-3 border-b border-border bg-surface p-3 sm:p-4 lg:max-h-none lg:overflow-y-auto">
            <CarinaEditor
              value={query}
              onChange={setQuery}
              placeholder="What do you want to research?"
              variant="compact"
              minHeight="6rem"
              showEngineSwitch={false}
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
                      'flex w-full min-w-0 items-start gap-2 rounded-md border px-2.5 py-2 text-left transition-colors',
                      mode === itemMode
                        ? 'border-accent/40 bg-accent/10'
                        : 'border-border bg-elevated hover:bg-overlay',
                    )}
                  >
                    <span className="mt-0.5 w-14 shrink-0 text-[11px] font-medium capitalize text-text-primary sm:w-16">
                      {itemMode}
                    </span>
                    <span className="min-w-0 text-[11px] leading-4 text-text-muted">{description}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-[11px] font-medium text-text-muted">Depth</p>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
                {DEPTH_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setRounds(preset.rounds)}
                    className={cn(
                      'rounded-md border px-2 py-2 text-left transition-colors',
                      activeDepth === preset.id
                        ? 'border-accent/40 bg-accent/10'
                        : 'border-border bg-elevated hover:bg-overlay',
                    )}
                  >
                    <span className="block text-[11px] font-semibold text-text-primary">{preset.label}</span>
                    <span className="mt-0.5 block text-[10px] leading-3 text-text-muted">{preset.hint}</span>
                  </button>
                ))}
              </div>
            </div>

            <Button type="submit" size="sm" disabled={submitting || query.trim().length < 5} className="h-auto min-h-8 w-full whitespace-normal px-3 py-2 text-center leading-4">
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
              {submitting ? 'Starting' : `Start ${DEPTH_PRESETS.find((p) => p.id === activeDepth)?.label ?? 'Standard'} research`}
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

          <div className="min-h-0 flex-1 overflow-visible lg:overflow-y-auto">
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
                    'flex w-full min-w-0 items-start gap-3 border-b border-border px-4 py-3 text-left transition-colors hover:bg-surface',
                    activeJob?.id === job.id && 'bg-surface',
                  )}
                >
                  <span className="mt-0.5 shrink-0">{STATUS_ICON[job.status]}</span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-xs leading-5 text-text-primary">{job.query}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-text-muted">
                      <span className="capitalize">{job.mode}</span>
                      <span>{job.rounds} rounds</span>
                      <span>{new Date(job.createdAt).toLocaleDateString()}</span>
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      </aside>

      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-visible lg:overflow-hidden">
        {!activeJob ? (
          <div className="flex flex-1 items-center justify-center px-4 py-12">
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
            <div className="flex min-w-0 flex-col gap-3 border-b border-border px-3 py-3 sm:px-6 sm:py-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-start gap-3 sm:items-center">
                {STATUS_ICON[activeJob.status]}
                <div className="min-w-0">
                  <h2 className="line-clamp-3 text-sm font-semibold leading-tight text-text-primary sm:line-clamp-2 lg:line-clamp-1">
                    {activeJob.query}
                  </h2>
                  <p className="mt-1 text-[11px] capitalize leading-4 text-text-muted">
                    {activeJob.mode} / {activeJob.rounds} rounds / {formatDate(activeJob.createdAt)}
                  </p>
                </div>
              </div>
              <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:shrink-0 sm:flex-wrap sm:items-center">
                {activeJob.status === 'completed' && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void discussInChat(activeJob)}
                      className="h-auto min-h-8 whitespace-normal px-2 py-2 text-center leading-4 sm:px-3"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      Discuss in chat
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={savingDoc || !activeJob.output}
                      onClick={() => void saveAsDocument(activeJob)}
                      className="h-auto min-h-8 whitespace-normal px-2 py-2 text-center leading-4 sm:px-3"
                    >
                      {savingDoc ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                      {savingDoc ? 'Saving' : 'Save as document'}
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => downloadMarkdown(activeJob)} className="px-2 sm:px-3">
                      <Download className="h-3.5 w-3.5" />
                      MD
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => downloadHtml(activeJob)} className="px-2 sm:px-3">
                      <Download className="h-3.5 w-3.5" />
                      HTML
                    </Button>
                  </>
                )}
                <IconButton label="Delete report" size="sm" className="min-h-8 justify-self-end px-2 sm:min-h-0" onClick={() => void deleteJob(activeJob)}>
                  <Trash2 className="h-3.5 w-3.5 text-danger" />
                </IconButton>
              </div>
            </div>

            {(activeJob.status === 'queued' || activeJob.status === 'running') && (
              <div className="flex items-start gap-3 border-b border-border bg-surface px-3 py-3 sm:items-center sm:px-6">
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-accent" />
                <p className="text-xs text-text-secondary">
                  {activeJob.status === 'queued'
                    ? 'Research queued. It will start shortly.'
                    : `Running deep web research (${activeJob.rounds} depth rounds). This can take several minutes.`}
                </p>
              </div>
            )}

            {activeJob.status === 'failed' && (
              <div className="border-b border-border bg-danger/10 px-3 py-3 sm:px-6">
                <p className="text-xs text-danger">Research failed: {activeJob.error ?? 'Unknown error'}</p>
              </div>
            )}

            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-visible xl:flex-row xl:overflow-hidden">
              <section className="min-w-0 flex-1 overflow-visible px-3 py-4 sm:px-6 sm:py-5 lg:overflow-y-auto">
                {activeJob.status === 'completed' && activeJob.output ? (
                  <div className="research-report mx-auto max-w-4xl min-w-0 overflow-hidden break-words text-sm [overflow-wrap:anywhere] sm:text-base">
                    <MarkdownContent content={activeJob.output} />
                  </div>
                ) : activeJob.status === 'queued' || activeJob.status === 'running' ? (
                  <div className="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center sm:py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-accent" />
                    <p className="text-xs text-text-muted">Carina is researching.</p>
                    <p className="text-[11px] text-text-muted">Results will appear here when complete.</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center sm:py-20">
                    <FileText className="h-8 w-8 text-text-muted" />
                    <p className="text-xs text-text-muted">No output available.</p>
                  </div>
                )}
              </section>

              {sources.length > 0 && (
                <aside className="w-full min-w-0 shrink-0 overflow-visible border-t border-border bg-surface xl:max-h-none xl:w-72 xl:overflow-y-auto xl:border-l xl:border-t-0">
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
                        <span className="flex min-w-0 items-start gap-2">
                          <span className="line-clamp-2 min-w-0 text-xs leading-5 text-text-primary">{source.title}</span>
                          <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-text-muted" />
                        </span>
                        <span className="mt-1 block break-all text-[10px] leading-4 text-text-muted">{source.url}</span>
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
