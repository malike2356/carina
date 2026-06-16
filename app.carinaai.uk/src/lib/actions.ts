'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { db } from '@/db';
import { byokKeys, workspaces } from '@/db/schema';
import { writeAuditLog } from '@/lib/audit';
import { encryptKey, maskKeyHint } from '@/lib/vault';
import { requireSession, requireWorkspace } from '@/lib/session';

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
  revalidatePath('/dashboard');
}

export async function pairScout(formData: FormData) {
  const session = await requireSession();
  const workspace = await requireWorkspace(session.user.id);
  if (workspace.plan !== 'team') {
    throw new Error('Scout pairing requires the Team plan');
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
    detail: { consoleUrl },
    ip: hdrs.get('x-forwarded-for') ?? hdrs.get('x-real-ip'),
  });

  revalidatePath('/security');
}
