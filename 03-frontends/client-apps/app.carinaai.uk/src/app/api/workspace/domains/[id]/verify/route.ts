import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { customDomains } from '@/db/schema';
import {
  dnsVerificationRecordName,
  verificationTxtValue,
} from '@/lib/custom-domains';
import { isWorkspaceOwner } from '@/lib/terminal-access';
import { getSession, requireWorkspace } from '@/lib/session';

export const dynamic = 'force-dynamic';

async function verifyDns(hostname: string, token: string): Promise<void> {
  const dns = await import('node:dns/promises');
  const recordName = dnsVerificationRecordName(hostname);
  const expected = verificationTxtValue(token);
  let records: string[][] = [];
  try {
    records = await dns.resolveTxt(recordName);
  } catch (err) {
    const code = err && typeof err === 'object' && 'code' in err ? String((err as { code: string }).code) : '';
    if (code !== 'ENOTFOUND' && code !== 'ENODATA') {
      throw new Error(`DNS lookup failed for ${recordName}`);
    }
  }
  const flat = records.flat().map((value) => value.trim());
  if (!flat.includes(expected)) {
    throw new Error(`Missing verification TXT record ${recordName} = ${expected}`);
  }
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspace = await requireWorkspace(session.user.id);
  if (!await isWorkspaceOwner(workspace.id, session.user.id)) {
    return NextResponse.json({ error: 'Only the workspace owner can verify custom domains' }, { status: 403 });
  }

  const { id } = await context.params;
  const [domain] = await db
    .select()
    .from(customDomains)
    .where(and(eq(customDomains.id, id), eq(customDomains.workspaceId, workspace.id)))
    .limit(1);

  if (!domain) {
    return NextResponse.json({ error: 'Custom domain not found' }, { status: 404 });
  }

  try {
    await verifyDns(domain.hostname, domain.verificationToken);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Verification failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const [updated] = await db
    .update(customDomains)
    .set({
      verifiedAt: domain.verifiedAt ?? new Date(),
      tlsStatus: 'active',
    })
    .where(eq(customDomains.id, domain.id))
    .returning();

  return NextResponse.json({ data: updated });
}
