import fs from 'node:fs/promises';
import path from 'node:path';
import { appendSecurityAudit, searchSecurityAudit } from '../security-audit.js';
import { listRecentMemories } from '../../memory/store.js';
import type { DsarRequestType, DsarResult } from './types.js';
import { dsarDir } from './paths.js';

export type UserDataBundle = {
  userId: string;
  collectedAt: string;
  memories: Array<Record<string, unknown>>;
  auditEvents: Array<Record<string, unknown>>;
  metadata: Record<string, unknown>;
};

export async function collectUserData(userId: string): Promise<UserDataBundle> {
  const memories = await listRecentMemories(500);
  const filtered = memories.filter((row) => {
    const sessionId = String((row as { sessionId?: string }).sessionId ?? '');
    return sessionId.includes(userId) || JSON.stringify(row).includes(userId);
  });
  const auditEvents = searchSecurityAudit({ limit: 200 }).filter(
    (row) => row.sessionId?.includes(userId) || row.detail.includes(userId),
  );
  return {
    userId,
    collectedAt: new Date().toISOString(),
    memories: filtered.map((row) => ({ ...row })),
    auditEvents: auditEvents.map((row) => ({ ...row })),
    metadata: { source: 'carina compliance dsar collector' },
  };
}

export async function generateDSARReport(userId: string, data: UserDataBundle): Promise<string> {
  await fs.mkdir(dsarDir(), { recursive: true });
  const filePath = path.join(dsarDir(), `${userId}-access-${Date.now()}.json`);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), { mode: 0o600 });
  return filePath;
}

export async function exportPortableData(userId: string, data: UserDataBundle): Promise<string> {
  await fs.mkdir(dsarDir(), { recursive: true });
  const filePath = path.join(dsarDir(), `${userId}-portable-${Date.now()}.json`);
  const portable = {
    schema: 'carina-dsar-portable/v1',
    userId,
    exportedAt: data.collectedAt,
    records: data.memories,
    auditEvents: data.auditEvents,
  };
  await fs.writeFile(filePath, JSON.stringify(portable, null, 2), { mode: 0o600 });
  return filePath;
}

export async function deleteUserData(userId: string): Promise<number> {
  const { clearSession } = await import('../../memory/store.js');
  const data = await collectUserData(userId);
  const sessionIds = [...new Set(
    data.memories
      .map((row) => String((row as { sessionId?: string }).sessionId ?? ''))
      .filter(Boolean),
  )];
  for (const sessionId of sessionIds) {
    await clearSession(sessionId);
  }
  appendSecurityAudit({
    category: 'attestation',
    action: 'dsar_delete',
    detail: `DSAR erasure completed for user ${userId}`,
    metadata: { userId, sessionsCleared: sessionIds.length },
  });
  return sessionIds.length;
}

export async function verifyDeletion(userId: string): Promise<boolean> {
  const data = await collectUserData(userId);
  return data.memories.length === 0;
}

export async function handleDSAR(
  userId: string,
  requestType: DsarRequestType,
): Promise<DsarResult> {
  switch (requestType) {
    case 'access': {
      const data = await collectUserData(userId);
      const exportPath = await generateDSARReport(userId, data);
      return {
        userId,
        requestType,
        completedAt: new Date().toISOString(),
        exportPath,
        summary: `Access report written with ${data.memories.length} memory record(s)`,
      };
    }
    case 'delete': {
      const deletedRecords = await deleteUserData(userId);
      const verified = await verifyDeletion(userId);
      return {
        userId,
        requestType,
        completedAt: new Date().toISOString(),
        deletedRecords,
        verified,
        summary: verified
          ? `Erasure verified for user ${userId}`
          : `Erasure incomplete for user ${userId}`,
      };
    }
    case 'portability': {
      const data = await collectUserData(userId);
      const exportPath = await exportPortableData(userId, data);
      return {
        userId,
        requestType,
        completedAt: new Date().toISOString(),
        exportPath,
        summary: `Portable export written with ${data.memories.length} record(s)`,
      };
    }
    default:
      throw new Error(`Unsupported DSAR type: ${requestType satisfies never}`);
  }
}
