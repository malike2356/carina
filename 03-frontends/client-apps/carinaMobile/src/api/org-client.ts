export interface OrgInvite {
  id: string;
  orgId: string;
  email: string;
  role: string;
  expiresAt: string;
  acceptedAt: string | null;
}

async function orgFetch<T>(
  baseUrl: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${baseUrl.replace(/\/+$/, '')}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Org API ${response.status}: ${body || response.statusText}`);
  }
  return response.json() as Promise<T>;
}

export function listOrgInvites(baseUrl: string): Promise<{ invites: OrgInvite[] }> {
  return orgFetch(baseUrl, '/app/auth/org/invites');
}

export function createOrgInvite(
  baseUrl: string,
  email: string,
  role: string,
): Promise<{ ok: boolean; inviteId: string; token: string; emailSent?: boolean }> {
  return orgFetch(baseUrl, '/app/auth/org/invites', {
    method: 'POST',
    body: JSON.stringify({ email, role }),
  });
}

export function revokeOrgInvite(baseUrl: string, inviteId: string): Promise<{ ok: boolean }> {
  return orgFetch(baseUrl, `/app/auth/org/invites/${encodeURIComponent(inviteId)}`, {
    method: 'DELETE',
  });
}

export function acceptOrgInvite(
  baseUrl: string,
  token: string,
): Promise<{ ok: boolean; orgId: string; role: string }> {
  return orgFetch(baseUrl, '/app/auth/org/invites/accept', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}
