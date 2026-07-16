import type { SessionOptions } from 'iron-session';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import type { NextResponse } from 'next/server';

export interface AdminSessionData {
  email: string;
  adminToken: string;
  userId?: string;
  isAdmin?: boolean;
  pendingTotp?: 'totp_setup' | 'totp_verify';
  pendingToken?: string;
  pendingOtpauthUrl?: string;
  totpAttempts?: number;
}

function sessionPassword(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (secret && secret.length >= 32) {
    return secret;
  }
  return 'dev-only-admin-session-secret-min-32-chars';
}

export function getAdminSessionOptions(): SessionOptions {
  return {
    password: sessionPassword(),
    cookieName: 'carina_admin_session',
    cookieOptions: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 8,
    },
  };
}

export const adminSessionOptions = getAdminSessionOptions();

export async function getAdminSession() {
  return getIronSession<AdminSessionData>(await cookies(), getAdminSessionOptions());
}

export async function getAdminSessionFromRequest(
  request: NextRequest,
  response: NextResponse,
) {
  return getIronSession<AdminSessionData>(request, response, getAdminSessionOptions());
}

export function isValidAdminSession(session: AdminSessionData): boolean {
  return Boolean(session.email && session.adminToken && session.isAdmin !== false && !session.pendingTotp);
}

export async function requireAdminSession(): Promise<AdminSessionData | null> {
  const session = await getAdminSession();
  if (!isValidAdminSession(session)) {
    return null;
  }
  return session;
}

export async function destroyAdminSession(): Promise<void> {
  const session = await getAdminSession();
  session.destroy();
}
