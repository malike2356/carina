# Prompt 13 - Deep Research Page

## Objective

Build the `/research` page: a dedicated deep research interface where users submit a research query, choose a research mode and depth (number of rounds), and Carina runs a multi-step web search + synthesis loop. Results are stored in the `researchJobs` table and users can view, export, and reference previous research from the same page.

This is a major feature differentiation. Odysseus has no equivalent; this puts Carina decisively ahead for professional users who need substantive research, not just a chat response.

---

## Context

Working directory: `/opt/lampp/htdocs/verlox/carina/app.carinaai.uk`

Prerequisites: Prompts 00-12 complete. `researchJobs` table exists (Prompt 01). The sidebar links to `/research`.

Note on execution: The actual multi-step research loop runs in `core.carinaai.uk`. This prompt wires the UI to a `/api/research` endpoint that submits the job and polls for status. The core integration is stubbed with a realistic response shape. The stub is clearly labelled so the integration team can replace it.

---

## Step 1 - Research API Routes

### POST /api/research - Submit a Job

Create `src/app/api/research/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { getSession, requireWorkspace } from '@/lib/session';
import { db } from '@/db';
import { researchJobs } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const workspace = await requireWorkspace(session.user.id);

  const jobs = await db
    .select()
    .from(researchJobs)
    .where(eq(researchJobs.workspaceId, workspace.id))
    .orderBy(desc(researchJobs.createdAt))
    .limit(50);

  return NextResponse.json({ data: jobs });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const workspace = await requireWorkspace(session.user.id);

  const body = await req.json() as { query?: string; mode?: string; rounds?: number };
  const query = String(body.query ?? '').trim();
  if (!query || query.length < 5) return NextResponse.json({ error: 'query must be at least 5 characters' }, { status: 400 });

  const validModes = ['auto', 'product', 'compare', 'how-to', 'fact-check'];
  const mode   = validModes.includes(body.mode ?? '') ? (body.mode as string) : 'auto';
  const rounds = Math.min(Math.max(1, body.rounds ?? 3), 10);

  const [job] = await db
    .insert(researchJobs)
    .values({ workspaceId: workspace.id, query, mode, rounds, status: 'queued' })
    .returning();

  // Hand off to core for execution (async, non-blocking)
  // The core service polls for queued jobs or accepts a webhook with the job id
  triggerResearchJob(job.id, workspace.id, query, mode, rounds).catch(console.error);

  return NextResponse.json({ data: job });
}

// Stub: in production, this calls core.carinaai.uk/research/start
async function triggerResearchJob(jobId: string, workspaceId: string, query: string, mode: string, rounds: number) {
  const coreUrl = process.env.CARINA_CORE_URL ?? 'http://localhost:3333';
  const coreKey = process.env.CARINA_INTERNAL_KEY ?? '';

  await db.update(researchJobs).set({ status: 'running' }).where(
    (await import('drizzle-orm')).eq((await import('@/db/schema')).researchJobs.id, jobId),
  );

  if (!coreKey) {
    // Dev stub: produce a fake result after 2 seconds
    await new Promise((r) => setTimeout(r, 2000));
    const { db: dbInstance } = await import('@/db');
    const { researchJobs: rj } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');
    await dbInstance.update(rj).set({
      status: 'completed',
      output: `## Research Summary: ${query}\n\nThis is a stub result generated in development mode. In production, Carina executes ${rounds} rounds of web search and synthesis.\n\n### Key Findings\n\n- Finding 1: Placeholder\n- Finding 2: Placeholder\n- Finding 3: Placeholder\n\n### Sources\n\n1. example.com/source-1\n2. example.com/source-2`,
      sources: JSON.stringify([{ url: 'https://example.com/1', title: 'Example Source', snippet: 'Placeholder' }]),
    }).where(eq(rj.id, jobId));
    return;
  }

  // Production path: POST to core
  await fetch(`${coreUrl}/research/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-internal-key': coreKey },
    body: JSON.stringify({ jobId, workspaceId, query, mode, rounds }),
  });
}
```

### GET /api/research/[id] - Job Status Polling

Create `src/app/api/research/[id]/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { getSession, requireWorkspace } from '@/lib/session';
import { db } from '@/db';
import { researchJobs } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const workspace = await requireWorkspace(session.user.id);

  const [job] = await db
    .select()
    .from(researchJobs)
    .where(and(eq(researchJobs.id, params.id), eq(researchJobs.workspaceId, workspace.id)))
    .limit(1);

  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ data: job });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const workspace = await requireWorkspace(session.user.id);

  const [job] = await db
    .select({ id: researchJobs.id })
    .from(researchJobs)
    .where(and(eq(researchJobs.id, params.id), eq(researchJobs.workspaceId, workspace.id)))
    .limit(1);

  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  await db.delete(researchJobs).where(eq(researchJobs.id, params.id));
  return NextResponse.json({ data: { ok: true } });
}
```

### POST /api/research/[id]/webhook - Core Callback

Create `src/app/api/research/[id]/webhook/route.ts` for the core service to push results back:

```ts
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { researchJobs } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const key = req.headers.get('x-internal-key');
  if (key !== process.env.CARINA_INTERNAL_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json() as { status: string; output?: string; sources?: unknown; error?: string };
  const updates: Partial<typeof researchJobs.$inferInsert> = { status: body.status as typeof researchJobs.$inferSelect['status'] };
  if (body.output)  updates.output  = body.output;
  if (body.sources) updates.sources = body.sources as typeof researchJobs.$inferInsert['sources'];
  if (body.error)   updates.error   = body.error;

  await db.update(researchJobs).set(updates).where(eq(researchJobs.id, params.id));
  return NextResponse.json({ data: { ok: true } });
}
```

---

## Step 2 - Research Page

Create `src/app/(workspace)/research/page.tsx`:

```tsx
'use client';
import { useState, useEffect, useRef } from 'react';
import { Search, Plus, Download, Trash2, RefreshCw, ChevronRight, Globe, FileText, Clock, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/utils';

interface ResearchJob {
  id: string;
  query: string;
  mode: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  rounds: number;
  output: string | null;
  sources: unknown;
  error: string | null;
  createdAt: string;
}

const MODE_DESCRIPTIONS: Record<string, string> = {
  'auto':       'Let Carina decide the best research approach',
  'product':    'Research a product, company, or service',
  'compare':    'Compare two or more options side by side',
  'how-to':     'Find step-by-step guidance or instructions',
  'fact-check': 'Verify a claim against multiple sources',
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  queued:    <Clock className="h-4 w-4 text-text-muted" />,
  running:   <Loader2 className="h-4 w-4 text-accent animate-spin" />,
  completed: <CheckCircle className="h-4 w-4 text-green-500" />,
  failed:    <XCircle className="h-4 w-4 text-danger" />,
};

function parseSources(raw: unknown): Array<{ url: string; title: string; snippet: string }> {
  if (!raw) return [];
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

export default function ResearchPage() {
  const [jobs, setJobs] = useState<ResearchJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeJob, setActiveJob] = useState<ResearchJob | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState('auto');
  const [rounds, setRounds] = useState(3);
  const [submitting, setSubmitting] = useState(false);

  // Polling
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function loadJobs() {
    setLoading(true);
    const res = await fetch('/api/research');
    const d = await res.json();
    if (d.data) {
      setJobs(d.data);
      // If active job came from a previous session, re-select
      if (activeJob) {
        const updated = d.data.find((j: ResearchJob) => j.id === activeJob.id);
        if (updated) setActiveJob(updated);
      }
    }
    setLoading(false);
  }

  useEffect(() => { loadJobs(); }, []);

  // Poll active running jobs every 3 seconds
  useEffect(() => {
    const runningIds = jobs.filter((j) => j.status === 'queued' || j.status === 'running').map((j) => j.id);
    if (!runningIds.length) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    pollRef.current = setInterval(async () => {
      for (const id of runningIds) {
        const res = await fetch(`/api/research/${id}`);
        const d = await res.json();
        if (d.data) {
          setJobs((prev) => prev.map((j) => j.id === id ? d.data : j));
          if (activeJob?.id === id) setActiveJob(d.data);
        }
      }
    }, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [jobs.map((j) => j.status).join(',')]);

  async function submitResearch() {
    if (!query.trim()) return;
    setSubmitting(true);
    const res = await fetch('/api/research', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: query.trim(), mode, rounds }),
    });
    const d = await res.json();
    if (d.data) {
      setJobs((prev) => [d.data, ...prev]);
      setActiveJob(d.data);
      setQuery('');
      setShowForm(false);
    }
    setSubmitting(false);
  }

  async function deleteJob(id: string) {
    if (!confirm('Delete this research report?')) return;
    await fetch(`/api/research/${id}`, { method: 'DELETE' });
    setJobs((prev) => prev.filter((j) => j.id !== id));
    if (activeJob?.id === id) setActiveJob(null);
  }

  function exportMarkdown(job: ResearchJob) {
    const content = `# Research: ${job.query}\n\nMode: ${job.mode} | Rounds: ${job.rounds}\nDate: ${new Date(job.createdAt).toLocaleString()}\n\n---\n\n${job.output ?? 'No output'}`;
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `research-${job.id.slice(0, 8)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const sources = parseSources(activeJob?.sources);

  return (
    <div className="flex h-full bg-base">
      {/* Left: Job list */}
      <div className="w-80 shrink-0 border-r border-border flex flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-sm font-semibold text-text-primary">Research</span>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1 rounded-md bg-accent px-2.5 py-1.5 text-xs font-medium text-black hover:bg-accent-hover"
          >
            <Plus className="h-3.5 w-3.5" />
            New
          </button>
        </div>

        {showForm && (
          <div className="border-b border-border bg-surface p-4 space-y-3">
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="What do you want to research?"
              rows={3}
              autoFocus
              className="w-full resize-none rounded-md border border-border bg-elevated px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-border-focus"
            />
            <div>
              <label className="mb-1 block text-[10px] text-text-muted">Mode</label>
              <div className="flex flex-col gap-1">
                {Object.entries(MODE_DESCRIPTIONS).map(([m, desc]) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={cn(
                      'flex items-start gap-2 rounded-md border px-2.5 py-1.5 text-left transition-colors',
                      mode === m
                        ? 'border-accent/40 bg-accent-dim text-accent'
                        : 'border-transparent bg-elevated text-text-secondary hover:text-text-primary',
                    )}
                  >
                    <span className="text-[10px] font-medium mt-0.5 capitalize shrink-0">{m}</span>
                    <span className="text-[10px] text-text-muted">{desc}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[10px] text-text-muted">Research rounds: {rounds}</label>
              <input
                type="range"
                min={1}
                max={10}
                value={rounds}
                onChange={(e) => setRounds(Number(e.target.value))}
                className="w-full accent-green-500"
              />
              <div className="flex justify-between text-[9px] text-text-muted">
                <span>1 (quick)</span>
                <span>10 (deep)</span>
              </div>
            </div>
            <button
              onClick={submitResearch}
              disabled={submitting || !query.trim()}
              className="w-full rounded-md bg-accent py-2 text-xs font-medium text-black hover:bg-accent-hover disabled:opacity-40"
            >
              {submitting ? 'Starting...' : `Start research (${rounds} rounds)`}
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : jobs.length === 0 ? (
            <div className="py-8 px-4 text-center">
              <p className="text-xs text-text-muted">No research yet</p>
              <p className="text-[10px] text-text-muted mt-1">Click New to start your first research job</p>
            </div>
          ) : (
            jobs.map((job) => (
              <button
                key={job.id}
                onClick={() => setActiveJob(job)}
                className={cn(
                  'flex w-full items-start gap-3 border-b border-border px-4 py-3 text-left hover:bg-surface transition-colors',
                  activeJob?.id === job.id && 'bg-surface',
                )}
              >
                <div className="mt-0.5 shrink-0">{STATUS_ICON[job.status]}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-text-primary line-clamp-2 leading-relaxed">{job.query}</p>
                  <div className="mt-1 flex items-center gap-2 text-[10px] text-text-muted">
                    <span className="capitalize">{job.mode}</span>
                    <span>{job.rounds} rounds</span>
                    <span className="ml-auto">{new Date(job.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right: Active job view */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {!activeJob ? (
          <div className="flex flex-1 items-center justify-center">
            <EmptyState
              icon={<Search className="h-8 w-8" />}
              title="No research selected"
              subtitle="Click a research job on the left or start a new one."
              action={
                <button onClick={() => setShowForm(true)} className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-black hover:bg-accent-hover">
                  New research
                </button>
              }
            />
          </div>
        ) : (
          <>
            {/* Job header */}
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {STATUS_ICON[activeJob.status]}
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-text-primary leading-tight line-clamp-1">{activeJob.query}</h2>
                  <p className="text-[10px] text-text-muted mt-0.5 capitalize">
                    {activeJob.mode} - {activeJob.rounds} rounds - {new Date(activeJob.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-4">
                {activeJob.status === 'completed' && (
                  <button onClick={() => exportMarkdown(activeJob)} className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary">
                    <Download className="h-3.5 w-3.5" />
                    Export
                  </button>
                )}
                <IconButton label="Delete report" size="sm" onClick={() => deleteJob(activeJob.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-danger" />
                </IconButton>
              </div>
            </div>

            {/* Status banners */}
            {(activeJob.status === 'queued' || activeJob.status === 'running') && (
              <div className="border-b border-border bg-surface px-6 py-3 flex items-center gap-3">
                <Loader2 className="h-4 w-4 text-accent animate-spin shrink-0" />
                <p className="text-xs text-text-secondary">
                  {activeJob.status === 'queued'
                    ? 'Research queued - will start shortly...'
                    : `Running ${activeJob.rounds} rounds of web research...`}
                </p>
              </div>
            )}

            {activeJob.status === 'failed' && (
              <div className="border-b border-border bg-danger/10 px-6 py-3">
                <p className="text-xs text-danger">Research failed: {activeJob.error ?? 'Unknown error'}</p>
              </div>
            )}

            {/* Output */}
            <div className="flex flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto px-6 py-5">
                {activeJob.status === 'completed' && activeJob.output ? (
                  <div className="prose prose-sm prose-invert max-w-none text-text-primary [&_h1]:text-base [&_h1]:font-semibold [&_h2]:text-sm [&_h2]:font-semibold [&_h3]:text-xs [&_h3]:font-semibold [&_p]:text-xs [&_p]:text-text-secondary [&_li]:text-xs [&_li]:text-text-secondary [&_a]:text-accent">
                    <pre className="whitespace-pre-wrap text-xs text-text-primary font-sans leading-relaxed">{activeJob.output}</pre>
                  </div>
                ) : activeJob.status === 'queued' || activeJob.status === 'running' ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <Loader2 className="h-8 w-8 text-accent animate-spin" />
                    <p className="text-xs text-text-muted">Carina is researching...</p>
                    <p className="text-[10px] text-text-muted">Results will appear here when complete</p>
                  </div>
                ) : null}
              </div>

              {/* Sources sidebar */}
              {sources.length > 0 && (
                <div className="w-64 shrink-0 border-l border-border overflow-y-auto">
                  <div className="px-4 py-3 border-b border-border">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                      <Globe className="h-3 w-3" />
                      Sources ({sources.length})
                    </p>
                  </div>
                  <div className="divide-y divide-border">
                    {sources.map((src, i) => (
                      <a
                        key={i}
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block px-4 py-3 hover:bg-surface transition-colors group"
                      >
                        <p className="text-xs text-text-primary group-hover:text-accent line-clamp-2 leading-relaxed">{src.title}</p>
                        <p className="text-[10px] text-text-muted mt-1 truncate">{src.url}</p>
                        {src.snippet && <p className="text-[10px] text-text-muted mt-1 line-clamp-2">{src.snippet}</p>}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

---

## Step 3 - Add Research Link to Sidebar

In `src/components/shell/AppSidebar.tsx`, add the Research link in the Tools section:

```tsx
import { FlaskConical } from 'lucide-react';

{ label: 'Research', href: '/research', icon: <FlaskConical className="h-4 w-4" /> },
```

---

## Verification

After this prompt:
1. `/research` loads with a two-column layout (job list left, detail right)
2. Clicking "New" opens the form: query textarea, mode selector, rounds slider
3. The mode selector shows 5 modes with descriptions inline
4. The rounds slider goes from 1 (quick) to 10 (deep), defaulting to 3
5. Submitting creates a job and shows it in the list with "queued" status
6. The page polls every 3 seconds and updates the status icon
7. In dev (no CARINA_INTERNAL_KEY), the stub completes after ~2 seconds and shows placeholder output
8. Completed jobs show a scrollable output area with the research report
9. A sources panel appears on the right when the job has sources
10. "Export" downloads a .md file with the full report
11. Deleting a job with confirm removes it from the list
12. Running the page with multiple queued jobs polls all of them simultaneously
13. TypeScript builds without errors
