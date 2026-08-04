import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { researchJobs, type ResearchStatus } from '@/db/schema';
import { sanitizeCarinaProse } from '@/lib/writing-style';

type RouteContext = { params: Promise<{ id: string }> };

const VALID_STATUSES = ['queued', 'running', 'completed', 'failed'] as const;

export const dynamic = 'force-dynamic';

function isStatus(value: unknown): value is ResearchStatus {
  return VALID_STATUSES.includes(value as ResearchStatus);
}

export async function POST(request: Request, context: RouteContext) {
  const key = request.headers.get('x-internal-key');
  if (!process.env.CARINA_INTERNAL_KEY || key !== process.env.CARINA_INTERNAL_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  const body = (await request.json()) as {
    status?: string;
    output?: string;
    sources?: unknown;
    error?: string;
  };
  if (!isStatus(body.status)) {
    return NextResponse.json({ error: 'valid status is required' }, { status: 400 });
  }

  const updates: Partial<typeof researchJobs.$inferInsert> = {
    status: body.status,
  };
  if (typeof body.output === 'string') updates.output = sanitizeCarinaProse(body.output, { preserveWhitespace: true });
  if (body.sources !== undefined) updates.sources = body.sources;
  if (typeof body.error === 'string') updates.error = sanitizeCarinaProse(body.error);
  if (body.status === 'completed' || body.status === 'failed') updates.completedAt = new Date();

  await db.update(researchJobs).set(updates).where(eq(researchJobs.id, id));
  return NextResponse.json({ data: { ok: true } });
}
