'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { db } from '@/db';
import { byokKeys, users, workspaces } from '@/db/schema';
import { writeAuditLog } from '@/lib/audit';
import { encryptKey, maskKeyHint } from '@/lib/vault';
import { requireSession, requireWorkspace } from '@/lib/session';
import { resolveCoreProxyToken, resolveCoreUrl } from '@/lib/core-proxy';
import { assertOpsToken, canPairScout } from '@/lib/scout-pairing-access';

async function syncByokToCore(workspaceId: string, provider: string, apiKey: string): Promise<void> {
  const token = resolveCoreProxyToken();
  if (!token) return;
  const coreUrl = resolveCoreUrl().replace(/\/$/, '');
  await fetch(`${coreUrl}/api/admin/workspaces/${encodeURIComponent(workspaceId)}/byok-keys`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'x-internal-key': token,
    },
    body: JSON.stringify({ provider, apiKey }),
  }).catch(() => {
    // Vault save still succeeds if core sync is unavailable.
  });
}

export async function saveByokKey(formData: FormData) {
  const session = await requireSession();
  const workspace = await requireWorkspace(session.user.id);
  const provider = String(formData.get('provider') ?? '').trim().toLowerCase();
  const apiKey = String(formData.get('apiKey') ?? '').trim();

  if (!provider || !apiKey) {
    throw new Error('Provider and API key are required');
  }

  const sealed = encryptKey(apiKey, workspace.id);
  await db.insert(byokKeys).values({
    workspaceId: workspace.id,
    provider,
    encryptedKey: sealed.encrypted,
    iv: sealed.iv,
    tag: sealed.tag,
    keyHint: maskKeyHint(apiKey),
  });

  await syncByokToCore(workspace.id, provider, apiKey);

  const hdrs = await headers();
  await writeAuditLog({
    workspaceId: workspace.id,
    userId: session.user.id,
    action: 'vault.key_saved',
    detail: { provider },
    ip: hdrs.get('x-forwarded-for') ?? hdrs.get('x-real-ip'),
  });

  revalidatePath('/settings/keys');
}

export async function removeByokKey(keyId: string) {
  const session = await requireSession();
  const workspace = await requireWorkspace(session.user.id);
  await db
    .delete(byokKeys)
    .where(and(eq(byokKeys.workspaceId, workspace.id), eq(byokKeys.id, keyId)));

  const hdrs = await headers();
  await writeAuditLog({
    workspaceId: workspace.id,
    userId: session.user.id,
    action: 'vault.key_removed',
    detail: { keyId },
    ip: hdrs.get('x-forwarded-for') ?? hdrs.get('x-real-ip'),
  });

  revalidatePath('/settings/keys');
}

export async function updateWorkspaceSettings(formData: FormData) {
  const session = await requireSession();
  const workspace = await requireWorkspace(session.user.id);
  const name = String(formData.get('name') ?? workspace.name).trim();
  const timezone = String(formData.get('timezone') ?? workspace.timezone).trim();
  const activeSkillPacks = String(formData.get('activeSkillPacks') ?? workspace.activeSkillPacks).trim();

  await db
    .update(workspaces)
    .set({
      name,
      timezone,
      activeSkillPacks,
      updatedAt: new Date(),
    })
    .where(eq(workspaces.id, workspace.id));

  revalidatePath('/settings');
  revalidatePath('/launcher');
}

export async function pairScout(formData: FormData) {
  const session = await requireSession();
  const workspace = await requireWorkspace(session.user.id);
  const access = canPairScout({
    plan: workspace.plan,
    email: session.user.email,
    userId: session.user.id,
    workspaceId: workspace.id,
    scoutPairingAllowed: Boolean(
      (workspace as { scoutPairingAllowed?: boolean }).scoutPairingAllowed,
    ),
  });
  if (!access.allowed) {
    throw new Error('Scout pairing requires the Team plan (or an admin Scout unlock)');
  }

  const consoleUrl = String(formData.get('consoleUrl') ?? '').trim().replace(/\/$/, '');
  const apiKey = String(formData.get('apiKey') ?? '').trim();
  if (!consoleUrl || !apiKey) {
    throw new Error('Scout console URL and API key are required');
  }

  const health = await fetch(`${consoleUrl}/api/health`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!health.ok) {
    throw new Error('Could not verify Scout credentials');
  }

  const sealed = encryptKey(apiKey, workspace.id);
  await db.insert(byokKeys).values({
    workspaceId: workspace.id,
    provider: 'labyrinth-scout',
    encryptedKey: sealed.encrypted,
    iv: sealed.iv,
    tag: sealed.tag,
    keyHint: maskKeyHint(apiKey),
  });

  process.env.LABYRINTH_URL = consoleUrl;

  const hdrs = await headers();
  await writeAuditLog({
    workspaceId: workspace.id,
    userId: session.user.id,
    action: 'scout:paired',
    detail: {
      consoleUrl,
      viaBypass: access.viaBypass,
      plan: workspace.plan,
    },
    ip: hdrs.get('x-forwarded-for') ?? hdrs.get('x-real-ip'),
  });

  revalidatePath('/security');
  revalidatePath('/launcher');
}

export async function setScoutPairingAllowed(formData: FormData) {
  const session = await requireSession();
  assertOpsToken(String(formData.get('opsToken') ?? ''));

  const allowed = String(formData.get('allowed') ?? '') === '1';
  const targetEmail = String(formData.get('email') ?? '').trim().toLowerCase();
  const targetWorkspaceId = String(formData.get('workspaceId') ?? '').trim();

  let workspaceId = targetWorkspaceId;
  if (!workspaceId && targetEmail) {
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, targetEmail))
      .limit(1);
    if (!user) {
      throw new Error(`No Cloud user found for ${targetEmail}`);
    }
    const workspace = await requireWorkspace(user.id);
    workspaceId = workspace.id;
  }
  if (!workspaceId) {
    // Default: current signed-in workspace (self unlock).
    const workspace = await requireWorkspace(session.user.id);
    workspaceId = workspace.id;
  }

  await db
    .update(workspaces)
    .set({ scoutPairingAllowed: allowed, updatedAt: new Date() })
    .where(eq(workspaces.id, workspaceId));

  const hdrs = await headers();
  await writeAuditLog({
    workspaceId,
    userId: session.user.id,
    action: allowed ? 'scout:pairing-unlocked' : 'scout:pairing-locked',
    detail: {
      targetEmail: targetEmail || null,
      via: 'gui',
    },
    ip: hdrs.get('x-forwarded-for') ?? hdrs.get('x-real-ip'),
  });

  revalidatePath('/security');
  revalidatePath('/settings/ops-scout');
  revalidatePath('/launcher');
}
