import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  LEGAL_DOCUMENT_LABELS,
  LEGAL_MARKDOWN_FILES,
  LEGAL_PUBLIC_SLUGS,
  type LegalDocumentType,
} from '@/lib/legal/constants';
import { getCurrentLegalDocument, getLegalDocumentByVersion } from '@/lib/legal/documents';

const LEGAL_ROOT = path.resolve(process.cwd(), '../../../legal');

export async function loadLegalMarkdown(documentType: LegalDocumentType): Promise<string> {
  const filename = LEGAL_MARKDOWN_FILES[documentType];
  return readFile(path.join(LEGAL_ROOT, filename), 'utf8');
}

export async function resolveLegalPageMeta(
  documentType: LegalDocumentType,
  version?: string,
) {
  const doc = version
    ? await getLegalDocumentByVersion(documentType, version)
    : await getCurrentLegalDocument(documentType);

  const slug = LEGAL_PUBLIC_SLUGS[documentType];
  const resolvedVersion = doc?.version ?? version ?? '1.0';
  const effectiveDate = doc?.effectiveDate ?? '2026-06-30';
  const archiveUrl = `/legal/${slug}/v/${resolvedVersion}`;

  return {
    documentType,
    title: LEGAL_DOCUMENT_LABELS[documentType],
    version: resolvedVersion,
    effectiveDate,
    archiveUrl,
    slug,
  };
}

export const LEGAL_NAV_LINKS = (Object.keys(LEGAL_PUBLIC_SLUGS) as LegalDocumentType[]).map(
  (type) => ({
    href: `/legal/${LEGAL_PUBLIC_SLUGS[type]}`,
    label: LEGAL_DOCUMENT_LABELS[type],
  }),
);
