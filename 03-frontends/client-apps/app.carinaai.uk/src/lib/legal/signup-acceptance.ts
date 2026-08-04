import 'server-only';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { legalAcceptances } from '@/db/schema';
import { getCurrentLegalDocuments } from './documents';
import type { LegalDocumentType } from './constants';

const SIGNUP_LEGAL_TYPES = new Set<LegalDocumentType>([
  'terms_of_service',
  'privacy_policy',
]);

/** Record ToS + Privacy acceptances when the user checked terms at signup. */
export async function seedSignupLegalAcceptances(
  userId: string,
  workspaceId: string,
): Promise<void> {
  const current = await getCurrentLegalDocuments();
  const docs = current.filter((doc) => SIGNUP_LEGAL_TYPES.has(doc.type));
  if (docs.length === 0) return;

  for (const doc of docs) {
    const [existing] = await db
      .select({ id: legalAcceptances.id })
      .from(legalAcceptances)
      .where(
        and(
          eq(legalAcceptances.userId, userId),
          eq(legalAcceptances.documentType, doc.type),
          eq(legalAcceptances.documentVersion, doc.version),
        ),
      )
      .limit(1);
    if (existing) continue;

    await db.insert(legalAcceptances).values({
      userId,
      workspaceId,
      documentType: doc.type,
      documentVersion: doc.version,
      ipAddressHash: null,
      userAgent: 'signup',
    });
  }
}
