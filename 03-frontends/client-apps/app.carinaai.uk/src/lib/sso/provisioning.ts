import crypto from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { users, accounts, workspaces, workspaceMembers } from '@/db/schema';
import type { WorkspaceSsoProvider } from '@/db/schema';
import { writeAuditLog } from '@/lib/audit';

export interface SsoIdentity {
  sub: string;
  email: string;
  name?: string;
  emailVerified?: boolean;
}

export interface ProvisionResult {
  userId: string;
  workspaceId: string;
  isNew: boolean;
}

function generateId(): string {
  return crypto.randomBytes(16).toString('hex');
}

export async function provisionSsoUser(
  identity: SsoIdentity,
  provider: WorkspaceSsoProvider,
  ip?: string | null,
): Promise<ProvisionResult> {
  const providerId = `sso_${provider.id}`;

  const existingAccount = await db
    .select({ userId: accounts.userId })
    .from(accounts)
    .where(and(eq(accounts.providerId, providerId), eq(accounts.accountId, identity.sub)))
    .limit(1);

  let userId: string;
  let isNew = false;

  if (existingAccount.length > 0) {
    userId = existingAccount[0].userId;
  } else {
    const existingUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, identity.email.toLowerCase()))
      .limit(1);

    if (existingUser.length > 0) {
      userId = existingUser[0].id;
    } else {
      const newId = generateId();
      await db.insert(users).values({
        id: newId,
        name: identity.name ?? identity.email.split('@')[0],
        email: identity.email.toLowerCase(),
        emailVerified: identity.emailVerified ?? true,
      });
      userId = newId;
      isNew = true;

      await writeAuditLog({
        workspaceId: provider.workspaceId,
        userId,
        action: 'sso.user.provisioned',
        detail: { providerId: provider.id, domain: provider.domain, email: identity.email },
        ip,
      });
    }

    await db.insert(accounts).values({
      id: generateId(),
      userId,
      accountId: identity.sub,
      providerId,
    });
  }

  await ensureSsoWorkspaceMember(userId, provider, ip);

  return { userId, workspaceId: provider.workspaceId, isNew };
}

async function ensureSsoWorkspaceMember(
  userId: string,
  provider: WorkspaceSsoProvider,
  ip?: string | null,
): Promise<void> {
  const ownerWs = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(and(eq(workspaces.id, provider.workspaceId), eq(workspaces.userId, userId)))
    .limit(1);

  if (ownerWs.length > 0) return;

  const existingMember = await db
    .select({ id: workspaceMembers.id })
    .from(workspaceMembers)
    .where(and(
      eq(workspaceMembers.workspaceId, provider.workspaceId),
      eq(workspaceMembers.userId, userId),
    ))
    .limit(1);

  if (existingMember.length > 0) return;

  const safeRole = provider.defaultRole === 'admin' ? 'admin' : 'member';

  await db.insert(workspaceMembers).values({
    workspaceId: provider.workspaceId,
    userId,
    role: safeRole,
  });

  await writeAuditLog({
    workspaceId: provider.workspaceId,
    userId,
    action: 'sso.workspace_member.created',
    detail: { providerId: provider.id, role: safeRole },
    ip,
  });
}
