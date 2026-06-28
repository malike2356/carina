import { cookies, headers } from 'next/headers';
import { auth } from './auth';
import { getWorkspaceForUser } from './workspace';

function normalizeSession(
  session: Awaited<ReturnType<typeof auth.api.getSession>>,
) {
  if (!session?.user?.id) return null;
  return session;
}

export async function authRequestHeaders(): Promise<Headers> {
  const requestHeaders = new Headers();
  const incoming = await headers();
  incoming.forEach((value, key) => {
    if (key.toLowerCase() === 'cookie') return;
    requestHeaders.append(key, value);
  });

  const cookieFromStore = (await cookies())
    .getAll()
    .map((entry) => `${entry.name}=${entry.value}`)
    .join('; ');
  const cookieFromHeaders = incoming.get('cookie') ?? '';
  const cookieHeader = cookieFromStore || cookieFromHeaders;
  if (cookieHeader) {
    requestHeaders.set('cookie', cookieHeader);
  }

  return requestHeaders;
}

export async function getSession() {
  return normalizeSession(
    await auth.api.getSession({
      headers: await authRequestHeaders(),
    }),
  );
}

export async function requireSession() {
  const session = await getSession();
  if (!session) {
    throw new Error('Unauthorized');
  }
  return session;
}

export async function requireWorkspace(userId: string) {
  const workspace = await getWorkspaceForUser(userId);
  if (!workspace) {
    throw new Error('Workspace not found');
  }
  return workspace;
}
