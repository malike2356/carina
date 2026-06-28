import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { accounts } from '@/db/schema';
import { db } from '@/db';
import { auth } from '@/lib/auth';
import { authRequestHeaders, getSession } from '@/lib/session';

const MIN_PASSWORD_LENGTH = 10;

async function userHasPassword(userId: string): Promise<boolean> {
  const rows = await db
    .select({ password: accounts.password })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.providerId, 'credential')))
    .limit(1);
  return Boolean(rows[0]?.password);
}

function forwardAuthCookies(source: Response, target: NextResponse) {
  for (const cookie of source.headers.getSetCookie()) {
    target.headers.append('Set-Cookie', cookie);
  }
}

async function readAuthError(response: Response): Promise<string> {
  const data = (await response.json().catch(() => ({}))) as { message?: string; error?: string };
  return data.message ?? data.error ?? 'Could not update password';
}

export async function GET() {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    email: session.user.email,
    hasPassword: await userHasPassword(session.user.id),
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
    revokeOtherSessions?: boolean;
  };

  const newPassword = String(body.newPassword ?? '');
  const confirmPassword = String(body.confirmPassword ?? '');
  const currentPassword = String(body.currentPassword ?? '');
  const revokeOtherSessions = body.revokeOtherSessions === true;

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` },
      { status: 400 },
    );
  }
  if (newPassword !== confirmPassword) {
    return NextResponse.json({ error: 'Passwords do not match.' }, { status: 400 });
  }

  const headers = await authRequestHeaders();
  const hasPassword = await userHasPassword(session.user.id);

  try {
    let authResponse: Response;
    if (hasPassword) {
      if (!currentPassword) {
        return NextResponse.json({ error: 'Current password is required.' }, { status: 400 });
      }
      authResponse = await auth.api.changePassword({
        body: {
          currentPassword,
          newPassword,
          revokeOtherSessions,
        },
        headers,
        asResponse: true,
      });
    } else {
      authResponse = await auth.api.setPassword({
        body: { newPassword },
        headers,
        asResponse: true,
      });
    }

    if (!authResponse.ok) {
      const message = await readAuthError(authResponse);
      const normalized = message.toLowerCase();
      if (normalized.includes('invalid password') || normalized.includes('incorrect')) {
        return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 400 });
      }
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const response = NextResponse.json({ ok: true, hasPassword: true });
    forwardAuthCookies(authResponse, response);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not update password';
    const normalized = message.toLowerCase();
    if (normalized.includes('invalid password') || normalized.includes('incorrect')) {
      return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 400 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
