'use client';

import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  ExternalLink,
  FileText,
  Globe,
  Loader2,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/button';
import { ResearchPaperView } from '@/components/research/ResearchPaperView';
import { ResearchAskDialog } from '@/components/research/ResearchAskDialog';
import { ResearchNewDialog } from '@/components/research/ResearchNewDialog';
import { WorkspaceFeatureGate } from '@/components/workspace/WorkspaceFeatureGate';
import {
  citationStyleLabel,
  parseCitationStyle,
} from '@/lib/research-citation-styles';
import { plainResearchTitle } from '@/lib/research-plain-title';
import { sanitizeCarinaProse } from '@/lib/writing-style';
import { cn } from '@/lib/utils';

type ResearchStatus = 'queued' | 'running' | 'completed' | 'failed';

interface ResearchJob {
  id: string;
  query: string;
  mode: string;
  citationStyle?: string | null;
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
  const style = citationStyleLabel(parseCitationStyle(job.citationStyle));
  const content = sanitizeCarinaProse(
    [
      job.output ?? 'No output',
      '',
      '---',
      `Query: ${job.query}`,
      `Mode: ${job.mode}`,
      `Citation style: ${style}`,
      `Depth rounds: ${job.rounds}`,
      `Date: ${new Date(job.createdAt).toLocaleString()}`,
    ].join('\n'),
  );
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `research-${job.id.slice(0, 8)}.md`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function downloadHtml(job: ResearchJob) {
  const style = citationStyleLabel(parseCitationStyle(job.citationStyle));
  const body = sanitizeCarinaProse(job.output ?? 'No output')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/^# (.*)$/gm, '<h1>$1</h1>')
    .replace(/^## (.*)$/gm, '<h2>$1</h2>')
    .replace(/^### (.*)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.*)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, (block) => `<ul>${block}</ul>`)
    .replace(/^(?!<[hul]|<li)(.+)$/gm, '<p>$1</p>');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${job.query.replace(/</g, '')}</title>
  <style>
    body { font-family: 'Instrument Sans', ui-sans-serif, system-ui, sans-serif; max-width: 720px; margin: 40px auto; padding: 0 24px 64px; line-height: 1.7; color: #1a1a1a; }
    h1 { font-size: 1.8rem; text-align: center; margin-bottom: 1.5rem; }
    h2 { font-size: 1.25rem; margin-top: 2rem; border-bottom: 1px solid #ddd; padding-bottom: 0.25rem; }
    h3 { font-size: 1.08rem; margin-top: 1.25rem; }
    p { margin: 0 0 0.9rem; text-align: justify; }
    ul { margin: 0 0 1rem 1.25rem; }
    .meta { font-family: 'Instrument Sans', ui-sans-serif, system-ui, sans-serif; font-size: 0.8rem; color: #555; text-align: center; margin-bottom: 2rem; }
  </style>
</head>
<body>
  <p class="meta">${style} · Mode: ${job.mode} · Depth: ${job.rounds} · ${new Date(job.createdAt).toLocaleString()}</p>
  ${body}
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

export default function ResearchPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<ResearchJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [savingDoc, setSavingDoc] = useState(false);
  const [askDraft, setAskDraft] = useState('');
  const [askOpen, setAskOpen] = useState(false);
  const [askSeed, setAskSeed] = useState('');
  const [mobilePane, setMobilePane] = useState<'list' | 'detail'>('list');
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [papersOpen, setPapersOpen] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const activeJob = useMemo(
    () => jobs.find((job) => job.id === activeJobId) ?? null,
    [activeJobId, jobs],
  );
  const sources = parseSources(activeJob?.sources);
  const showMobileDetail = mobilePane === 'detail' && Boolean(activeJob);

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

  async function deleteJob(job: ResearchJob) {
    if (!window.confirm('Delete this research report?')) return;
    await fetch(`/api/research/${job.id}`, { method: 'DELETE' });
    setJobs((current) => current.filter((item) => item.id !== job.id));
    if (activeJobId === job.id) {
      setActiveJobId(null);
      setMobilePane('list');
    }
  }

  function openAskDialog(seed = '') {
    setAskSeed(seed.trim());
    setAskOpen(true);
  }

  async function saveAsDocument(job: ResearchJob) {
    if (!job.output?.trim()) return;
    setSavingDoc(true);
    try {
      const title = sanitizeCarinaProse(`Research: ${plainResearchTitle(job.query)}`).slice(0, 120);
      const response = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content: sanitizeCarinaProse(job.output, { preserveWhitespace: true }),
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

  return (
    <WorkspaceFeatureGate
      feature="ai_agent_tools"
      title="Research unavailable"
      subtitle="AI agent tools are turned off for this workspace. Enable them in Settings > Features."
    >
    <div className="flex h-full min-w-0 overflow-x-hidden bg-base">
      <aside
        className={cn(
          'flex shrink-0 flex-col overflow-hidden border-r border-border bg-base transition-[width] duration-200',
          showMobileDetail ? 'hidden lg:flex' : 'flex w-full',
          showMobileDetail && papersOpen ? 'lg:w-60' : '',
          showMobileDetail && !papersOpen ? 'lg:w-0 lg:border-0' : '',
          !showMobileDetail ? 'lg:w-60' : '',
        )}
      >
        <div className={cn('flex min-h-0 flex-1 flex-col', showMobileDetail && !papersOpen && 'lg:hidden')}>
        <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-text-primary">Research</h1>
            <p className="mt-0.5 text-[10px] text-text-muted">Cited papers</p>
          </div>
          <Button type="button" size="sm" onClick={() => setShowForm(true)}>
            <Plus className="h-3.5 w-3.5" />
            New
          </Button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center gap-2 border-b border-border px-3 py-1.5">
            <span className="text-[10px] font-medium uppercase tracking-wide text-text-muted">Papers</span>
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
                <p className="mt-1 text-[11px] text-text-muted">Create a paper with a citation style to begin.</p>
              </div>
            ) : (
              jobs.map((job) => (
                <button
                  key={job.id}
                  type="button"
                  onClick={() => {
                    setActiveJobId(job.id);
                    setMobilePane('detail');
                    setSourcesOpen(false);
                    setAskDraft('');
                  }}
                  className={cn(
                    'flex w-full items-start gap-2.5 border-b border-border px-3 py-2.5 text-left transition-colors hover:bg-surface',
                    activeJob?.id === job.id && 'bg-surface',
                  )}
                >
                  <span className="mt-0.5 shrink-0">{STATUS_ICON[job.status]}</span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-xs leading-5 text-text-primary">
                      {plainResearchTitle(job.query)}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-text-muted">
                      <span>{citationStyleLabel(parseCitationStyle(job.citationStyle)).replace(' edition', '')}</span>
                      <span className="capitalize">{job.mode}</span>
                      <span className="ml-auto">{new Date(job.createdAt).toLocaleDateString()}</span>
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
        </div>
      </aside>

      <main
        className={cn(
          'relative min-w-0 flex-1 flex-col overflow-hidden',
          showMobileDetail ? 'flex' : 'hidden lg:flex',
        )}
      >
        {!activeJob ? (
          <div className="flex flex-1 items-center justify-center">
            <EmptyState
              icon={<Search className="h-8 w-8" />}
              title="No research selected"
              subtitle="Select an existing paper or start a new research job with APA, MLA, Chicago, or Harvard."
              action={
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setShowForm(true);
                    setMobilePane('list');
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  New research
                </Button>
              }
            />
          </div>
        ) : (
          <>
            <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-border bg-surface px-2 py-1.5 print:hidden sm:px-3">
              <button
                type="button"
                onClick={() => setMobilePane('list')}
                className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-text-secondary hover:bg-elevated lg:hidden"
                aria-label="Back to research list"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Papers
              </button>
              <IconButton
                label={papersOpen ? 'Hide papers list' : 'Show papers list'}
                size="sm"
                className="hidden lg:inline-flex"
                onClick={() => setPapersOpen((open) => !open)}
              >
                {papersOpen ? <PanelLeftClose className="h-3.5 w-3.5" /> : <PanelLeftOpen className="h-3.5 w-3.5" />}
              </IconButton>
              <span className="shrink-0">{STATUS_ICON[activeJob.status]}</span>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-xs font-semibold text-text-primary sm:text-sm">
                  {plainResearchTitle(activeJob.query)}
                </h2>
                <p className="truncate text-[10px] text-text-muted">
                  {citationStyleLabel(parseCitationStyle(activeJob.citationStyle))} ·{' '}
                  <span className="capitalize">{activeJob.mode}</span> · {activeJob.rounds} rounds ·{' '}
                  {formatDate(activeJob.createdAt)}
                  {sources.length > 0 ? ` · ${sources.length} sources` : ''}
                </p>
              </div>
              {activeJob.status === 'completed' ? (
                <div className="flex flex-wrap items-center gap-1">
                  <Button type="button" variant="outline" size="sm" onClick={() => openAskDialog()}>
                    <MessageSquare className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Discuss</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={savingDoc || !activeJob.output}
                    onClick={() => void saveAsDocument(activeJob)}
                  >
                    {savingDoc ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                    <span className="hidden md:inline">{savingDoc ? 'Saving' : 'Documents'}</span>
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => downloadMarkdown(activeJob)}>
                    .md
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => downloadHtml(activeJob)}>
                    .html
                  </Button>
                  {sources.length > 0 ? (
                    <Button
                      type="button"
                      variant={sourcesOpen ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSourcesOpen((open) => !open)}
                    >
                      <Globe className="h-3.5 w-3.5" />
                      Sources
                    </Button>
                  ) : null}
                </div>
              ) : null}
              <IconButton label="Delete report" size="sm" onClick={() => void deleteJob(activeJob)}>
                <Trash2 className="h-3.5 w-3.5 text-danger" />
              </IconButton>
            </div>

            {(activeJob.status === 'queued' || activeJob.status === 'running') && (
              <div className="flex items-center gap-3 border-b border-border bg-surface px-3 py-2 print:hidden">
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-accent" />
                <p className="text-xs text-text-secondary">
                  {activeJob.status === 'queued'
                    ? 'Research queued. It will start shortly.'
                    : `Writing a ${citationStyleLabel(parseCitationStyle(activeJob.citationStyle))} paper (${activeJob.rounds} depth rounds). This can take several minutes.`}
                </p>
              </div>
            )}

            {activeJob.status === 'failed' && (
              <div className="border-b border-border bg-danger/10 px-3 py-2 print:hidden">
                <p className="text-xs text-danger">Research failed: {activeJob.error ?? 'Unknown error'}</p>
              </div>
            )}

            <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
              <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                {activeJob.status === 'completed' && activeJob.output ? (
                  <>
                    <ResearchPaperView
                      jobId={activeJob.id}
                      query={plainResearchTitle(activeJob.query)}
                      mode={activeJob.mode}
                      rounds={activeJob.rounds}
                      citationStyle={activeJob.citationStyle}
                      createdAt={activeJob.createdAt}
                      content={activeJob.output}
                      sources={sources}
                      onSaved={({ output, citationStyle }) => {
                        setJobs((current) =>
                          current.map((job) =>
                            job.id === activeJob.id
                              ? { ...job, output, citationStyle }
                              : job,
                          ),
                        );
                      }}
                    />
                    <div className="shrink-0 border-t border-border bg-surface px-2 py-1.5 print:hidden sm:px-3">
                      <form
                        className="flex gap-2"
                        onSubmit={(event) => {
                          event.preventDefault();
                          if (!askDraft.trim()) return;
                          const question = askDraft.trim();
                          setAskDraft('');
                          openAskDialog(question);
                        }}
                      >
                        <input
                          value={askDraft}
                          onChange={(event) => setAskDraft(event.target.value)}
                          placeholder="Ask something about this paper..."
                          className="min-w-0 flex-1 rounded-md border border-border bg-base px-3 py-1.5 text-sm text-text-primary outline-none focus:border-accent/50"
                        />
                        <Button type="submit" size="sm" disabled={!askDraft.trim()}>
                          Ask
                        </Button>
                      </form>
                    </div>
                  </>
                ) : activeJob.status === 'queued' || activeJob.status === 'running' ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-accent" />
                    <p className="text-xs text-text-muted">Carina is researching and formatting the paper.</p>
                    <p className="text-[11px] text-text-muted">Headings, citations, and references will appear here.</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-3 py-20">
                    <FileText className="h-8 w-8 text-text-muted" />
                    <p className="text-xs text-text-muted">No output available.</p>
                  </div>
                )}
              </section>

              {sources.length > 0 && sourcesOpen ? (
                <>
                  <button
                    type="button"
                    aria-label="Close sources"
                    className="absolute inset-0 z-20 bg-black/35 print:hidden"
                    onClick={() => setSourcesOpen(false)}
                  />
                  <aside className="absolute inset-y-0 right-0 z-30 flex w-[min(100%,22rem)] flex-col border-l border-border bg-surface shadow-xl print:hidden">
                    <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                      <p className="flex min-w-0 flex-1 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                        <Globe className="h-3 w-3" />
                        Sources ({sources.length})
                      </p>
                      <IconButton label="Close sources" size="sm" onClick={() => setSourcesOpen(false)}>
                        <X className="h-3.5 w-3.5" />
                      </IconButton>
                    </div>
                    <p className="border-b border-border px-3 py-1.5 text-[10px] text-text-muted">
                      Formatted in-paper as {citationStyleLabel(parseCitationStyle(activeJob.citationStyle))}
                    </p>
                    <div className="min-h-0 flex-1 divide-y divide-border overflow-y-auto">
                      {sources.map((source, index) => (
                        <a
                          key={source.url}
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block px-3 py-2.5 transition-colors hover:bg-elevated"
                        >
                          <span className="mb-1 block text-[10px] font-semibold text-text-muted">
                            [{index + 1}]
                          </span>
                          <span className="flex items-start gap-2">
                            <span className="line-clamp-2 text-xs leading-5 text-text-primary">{source.title}</span>
                            <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-text-muted" />
                          </span>
                          <span className="mt-1 block truncate text-[10px] text-text-muted">{source.url}</span>
                          {source.snippet ? (
                            <span className="mt-1 line-clamp-3 block text-[11px] leading-4 text-text-muted">
                              {source.snippet}
                            </span>
                          ) : null}
                        </a>
                      ))}
                    </div>
                  </aside>
                </>
              ) : null}
            </div>
          </>
        )}
      </main>
      <ResearchNewDialog
        open={showForm}
        onOpenChange={setShowForm}
        onCreated={(job) => {
          setJobs((current) => [job as ResearchJob, ...current]);
          setActiveJobId(job.id);
          setMobilePane('detail');
        }}
      />
      {activeJob?.status === 'completed' ? (
        <ResearchAskDialog
          open={askOpen}
          onOpenChange={(open) => {
            setAskOpen(open);
            if (!open) setAskSeed('');
          }}
          jobId={activeJob.id}
          query={activeJob.query}
          initialQuestion={askSeed}
        />
      ) : null}
    </div>
    </WorkspaceFeatureGate>
  );
}
