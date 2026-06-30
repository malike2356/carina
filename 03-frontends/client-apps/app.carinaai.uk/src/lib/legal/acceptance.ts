import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { legalAcceptances, workspaceMembers, workspaces } from '@/db/schema';
import {
  getCurrentLegalDocuments,
  isCurrentLegalVersion,
  type LegalDocumentSummary,
} from './documents';
import { hashClientIp, resolveRequestIp } from './ip-hash';
import type { LegalDocumentType } from './constants';

export type LegalStatusResponse = {
  pending: LegalDocumentSummary[];
  accepted: Array<LegalDocumentSummary & { accepted_at: string }>;
  all_current_accepted: boolean;
};

export type LegalGatePayload = {
  code: 'legal_acceptance_required';
  pending: LegalDocumentSummary[];
};

export type AcceptanceInput = {
  document_type: LegalDocumentType;
  version: string;
};

function legalIpSalt(): string {
  return process.env.LEGAL_IP_SALT ?? 'dev-legal-ip-salt-change-me';
}

export async function getLegalStatus(
  userId: string,
  workspaceId: string,
): Promise<LegalStatusResponse> {
  const current = await getCurrentLegalDocuments();
  const rows = await db
    .select()
    .from(legalAcceptances)
    .where(eq(legalAcceptances.userId, userId));

  const acceptedByType = new Map<string, typeof legalAcceptances.$inferSelect>();
  for (const row of rows) {
    acceptedByType.set(`${row.documentType}:${row.documentVersion}`, row);
  }

  const pending: LegalDocumentSummary[] = [];
  const accepted: LegalStatusResponse['accepted'] = [];

  for (const doc of current) {
    const key = `${doc.type}:${doc.version}`;
    const record = acceptedByType.get(key);
    if (record) {
      accepted.push({
        ...doc,
        accepted_at: record.acceptedAt.toISOString(),
      });
    } else {
      pending.push(doc);
    }
  }

  return {
    pending,
    accepted,
    all_current_accepted: pending.length === 0,
  };
}

export async function recordLegalAcceptances(
  userId: string,
  workspaceId: string,
  acceptances: AcceptanceInput[],
  requestMeta: { forwardedFor: string | null; realIp: string | null; userAgent: string | null },
): Promise<{ accepted: number; all_current_accepted: boolean }> {
  if (acceptances.length === 0) {
    throw new LegalAcceptanceError('No acceptances provided', 400);
  }

  const ip = resolveRequestIp(requestMeta.forwardedFor, requestMeta.realIp);
  const ipHash = hashClientIp(ip, legalIpSalt());
  const userAgent = requestMeta.userAgent?.slice(0, 512) ?? null;

  let inserted = 0;

  for (const item of acceptances) {
    const current = await isCurrentLegalVersion(item.document_type, item.version);
    if (!current) {
      throw new LegalAcceptanceError(
        `Version ${item.version} of ${item.document_type} is not current`,
        400,
      );
    }

    const existing = await db
      .select({ id: legalAcceptances.id })
      .from(legalAcceptances)
      .where(
        and(
          eq(legalAcceptances.userId, userId),
          eq(legalAcceptances.documentType, item.document_type),
          eq(legalAcceptances.documentVersion, item.version),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      throw new LegalAcceptanceError(
        `Already accepted ${item.document_type} version ${item.version}`,
        409,
      );
    }

    await db.insert(legalAcceptances).values({
      userId,
      workspaceId,
      documentType: item.document_type,
      documentVersion: item.version,
      ipAddressHash: ipHash,
      userAgent,
    });
    inserted += 1;
  }

  const status = await getLegalStatus(userId, workspaceId);
  return {
    accepted: inserted,
    all_current_accepted: status.all_current_accepted,
  };
}

export async function getLegalAuditForWorkspace(workspaceId: string) {
  return db
    .select({
      id: legalAcceptances.id,
      userId: legalAcceptances.userId,
      documentType: legalAcceptances.documentType,
      documentVersion: legalAcceptances.documentVersion,
      acceptedAt: legalAcceptances.acceptedAt,
      ipAddressHash: legalAcceptances.ipAddressHash,
      userAgent: legalAcceptances.userAgent,
    })
    .from(legalAcceptances)
    .where(eq(legalAcceptances.workspaceId, workspaceId))
    .orderBy(legalAcceptances.acceptedAt);
}

export async function isWorkspaceAdmin(userId: string, workspaceId: string): Promise<boolean> {
  const [workspace] = await db
    .select({ ownerId: workspaces.userId })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  if (workspace?.ownerId === userId) return true;

  const [member] = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)))
    .limit(1);

  return member?.role === 'admin' || member?.role === 'owner';
}

export class LegalAcceptanceError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'LegalAcceptanceError';
  }
}

export function toLegalGatePayload(status: LegalStatusResponse): LegalGatePayload | null {
  if (status.all_current_accepted) return null;
  return {
    code: 'legal_acceptance_required',
    pending: status.pending,
  };
}
