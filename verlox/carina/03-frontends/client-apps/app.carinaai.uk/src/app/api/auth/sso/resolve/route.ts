import { NextResponse } from 'next/server';
import { z } from 'zod';
import { discoverSsoForEmail } from '@/lib/sso/policy';
import { writeAuditLog } from '@/lib/audit';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

const resolveSchema = z.object({
  email: z.string().email(),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = resolveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ssoAvailable: false }, { status: 400 });
  }

  const ip = (await headers()).get('x-forwarded-for') ?? undefined;
  const discovery = await discoverSsoForEmail(parsed.data.email);

  if (!discovery.ssoAvailable) {
    return NextResponse.json({ ssoAvailable: false });
  }

  await writeAuditLog({
    workspaceId: 'platform',
    action: 'sso.discovery.matched',
    detail: {
      domain: discovery.domain,
      providerId: discovery.providerId,
      providerType: discovery.providerType,
    },
    ip,
  }).catch(() => {});

  return NextResponse.json(discovery);
}
