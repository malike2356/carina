import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { LEGAL_DOCUMENT_TYPES } from '@/lib/legal/constants';
import { LegalAcceptanceError, recordLegalAcceptances } from '@/lib/legal/acceptance';
import { requireSession, requireWorkspace } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const acceptSchema = z.object({
  acceptances: z
    .array(
      z.object({
        document_type: z.enum(LEGAL_DOCUMENT_TYPES),
        version: z.string().min(1),
      }),
    )
    .min(1),
});

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const workspace = await requireWorkspace(session.user.id);
    const body = acceptSchema.parse(await request.json());

    const result = await recordLegalAcceptances(
      session.user.id,
      workspace.id,
      body.acceptances,
      {
        forwardedFor: request.headers.get('x-forwarded-for'),
        realIp: request.headers.get('x-real-ip'),
        userAgent: request.headers.get('user-agent'),
      },
    );

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof LegalAcceptanceError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
