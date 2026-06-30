import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { legalDocuments } from '@/db/schema';
import type { LegalDocumentType } from './constants';

export type LegalDocumentSummary = {
  type: LegalDocumentType;
  version: string;
  url: string;
  effectiveDate: string;
};

function rowToSummary(row: typeof legalDocuments.$inferSelect): LegalDocumentSummary {
  return {
    type: row.documentType as LegalDocumentType,
    version: row.version,
    url: row.contentUrl,
    effectiveDate: row.effectiveDate,
  };
}

export async function getCurrentLegalDocuments(): Promise<LegalDocumentSummary[]> {
  const rows = await db
    .select()
    .from(legalDocuments)
    .where(eq(legalDocuments.isCurrent, true))
    .orderBy(legalDocuments.documentType);

  return rows.map(rowToSummary);
}

export async function getLegalDocumentByVersion(
  documentType: LegalDocumentType,
  version: string,
): Promise<LegalDocumentSummary | null> {
  const [row] = await db
    .select()
    .from(legalDocuments)
    .where(and(eq(legalDocuments.documentType, documentType), eq(legalDocuments.version, version)))
    .limit(1);

  return row ? rowToSummary(row) : null;
}

export async function getCurrentLegalDocument(
  documentType: LegalDocumentType,
): Promise<LegalDocumentSummary | null> {
  const [row] = await db
    .select()
    .from(legalDocuments)
    .where(and(eq(legalDocuments.documentType, documentType), eq(legalDocuments.isCurrent, true)))
    .limit(1);

  return row ? rowToSummary(row) : null;
}

export async function isCurrentLegalVersion(
  documentType: LegalDocumentType,
  version: string,
): Promise<boolean> {
  const current = await getCurrentLegalDocument(documentType);
  return current?.version === version;
}
