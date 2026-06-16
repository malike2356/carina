import { headers } from 'next/headers';
import { auth } from './auth';
import { getWorkspaceForUser } from './workspace';

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
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
