import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { emailMessages, workspaceSettings } from '@/db/schema';
import {
  parseInboundEmailBody,
  verifyInboundPayload,
} from '@/lib/email-webhook';
import { emailBodyForDisplay } from '@/lib/email-text';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token')?.trim();
  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  }

  const [settings] = await db
    .select()
    .from(workspaceSettings)
    .where(eq(workspaceSettings.inboundEmailToken, token))
    .limit(1);

  if (!settings?.workspaceId) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get('x-carina-inbound-signature')?.trim() ?? '';
  const isProd = process.env.NODE_ENV === 'production';
  if (isProd && !verifyInboundPayload(token, rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const payload = parseInboundEmailBody(body);
  if (!payload.from) {
    return NextResponse.json({ error: 'Missing from address' }, { status: 400 });
  }

  const bodyFull = emailBodyForDisplay(payload.text || payload.html || '');
  const preview = bodyFull.slice(0, 500);

  const [created] = await db
    .insert(emailMessages)
    .values({
      workspaceId: settings.workspaceId,
      externalId: payload.messageId || null,
      fromAddress: payload.from,
      subject: payload.subject || '(no subject)',
      bodyPreview: preview,
      bodyFull,
      urgency: 'normal',
      status: 'inbox',
    })
    .returning();

  return NextResponse.json({ ok: true, id: created.id });
}
