import { NextResponse } from 'next/server';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { researchJobs } from '@/db/schema';
import {
  parseCitationStyle,
  reformatResearchDocument,
  type CitationSource,
} from '@/lib/research-citation-styles';
import { getSession, requireWorkspace } from '@/lib/session';
import { sanitizeCarinaProse } from '@/lib/writing-style';

type RouteContext = { params: Promise<{ id: string }> };

export const dynamic = 'force-dynamic';

let citationStyleColumnReady: Promise<void> | null = null;

function ensureCitationStyleColumn() {
  if (!citationStyleColumnReady) {
    citationStyleColumnReady = db
      .execute(
        sql`ALTER TABLE research_jobs ADD COLUMN IF NOT EXISTS citation_style varchar(20) DEFAULT 'apa7' NOT NULL`,
      )
      .then(() => undefined)
      .catch((error) => {
        citationStyleColumnReady = null;
        throw error;
      });
  }
  return citationStyleColumnReady;
}

function parseSources(raw: unknown): CitationSource[] {
  if (!raw) return [];
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((source, index) => ({
        id: String(source?.id ?? `src-${index + 1}`),
        url: String(source?.url ?? ''),
        title: String(source?.title ?? source?.url ?? 'Untitled source'),
        snippet: String(source?.snippet ?? ''),
        fetchedAt: source?.fetchedAt ? String(source.fetchedAt) : undefined,
      }))
      .filter((source) => source.url);
  } catch {
    return [];
  }
}

async function getOwnedResearchJob(userId: string, jobId: string) {
  const workspace = await requireWorkspace(userId);
  const [job] = await db
    .select()
    .from(researchJobs)
    .where(and(eq(researchJobs.id, jobId), eq(researchJobs.workspaceId, workspace.id)))
    .limit(1);

  return { workspace, job: job ?? null };
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;
  const { job } = await getOwnedResearchJob(session.user.id, id);
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ data: job });
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await ensureCitationStyleColumn();

  const { id } = await context.params;
  const { job } = await getOwnedResearchJob(session.user.id, id);
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = (await request.json()) as {
    output?: string;
    citationStyle?: string;
    reformatCitations?: boolean;
  };

  const hasOutput = typeof body.output === 'string';
  const hasStyle = body.citationStyle !== undefined;
  if (!hasOutput && !hasStyle) {
    return NextResponse.json(
      { error: 'output or citationStyle is required' },
      { status: 400 },
    );
  }

  const updates: Partial<typeof researchJobs.$inferInsert> = {};
  const nextStyle = hasStyle
    ? parseCitationStyle(body.citationStyle)
    : parseCitationStyle(job.citationStyle);
  if (hasStyle) updates.citationStyle = nextStyle;

  let nextOutput = hasOutput ? body.output! : (job.output ?? '');
  const shouldReformat = Boolean(body.reformatCitations) || (hasStyle && !hasOutput);
  if (shouldReformat) {
    const sources = parseSources(job.sources);
    if (sources.length === 0) {
      return NextResponse.json(
        { error: 'This research has no saved sources to cite. Run a new research job with web sources.' },
        { status: 400 },
      );
    }
    nextOutput = reformatResearchDocument(nextOutput, sources, nextStyle);
  }

  if (hasOutput || shouldReformat) {
    updates.output = sanitizeCarinaProse(nextOutput, { preserveWhitespace: true });
  }

  const [updated] = await db
    .update(researchJobs)
    .set(updates)
    .where(eq(researchJobs.id, id))
    .returning();

  return NextResponse.json({ data: updated });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;
  const { job } = await getOwnedResearchJob(session.user.id, id);
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await db.delete(researchJobs).where(eq(researchJobs.id, id));
  return NextResponse.json({ data: { ok: true } });
}
