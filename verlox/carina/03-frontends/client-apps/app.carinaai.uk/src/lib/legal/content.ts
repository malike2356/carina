import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  LEGAL_DOCUMENT_LABELS,
  LEGAL_MARKDOWN_FILES,
  LEGAL_PUBLIC_SLUGS,
  type LegalDocumentType,
} from '@/lib/legal/constants';
import { getCurrentLegalDocument, getLegalDocumentByVersion } from '@/lib/legal/documents';
import { applyLegalPlaceholders } from '@/lib/legal/placeholders';

/** Prefer app-bundled content/legal; fall back to legacy monorepo legal/ path. */
const LEGAL_ROOT_CANDIDATES = [
  path.resolve(process.cwd(), 'content/legal'),
  path.resolve(process.cwd(), '../../../legal'),
  path.resolve(process.cwd(), '../../legal'),
];

async function resolveLegalRoot(): Promise<string> {
  for (const root of LEGAL_ROOT_CANDIDATES) {
    try {
      await access(path.join(root, LEGAL_MARKDOWN_FILES.terms_of_service));
      return root;
    } catch {
      // try next
    }
  }
  return LEGAL_ROOT_CANDIDATES[0];
}

export async function loadLegalMarkdown(documentType: LegalDocumentType): Promise<string> {
  const filename = LEGAL_MARKDOWN_FILES[documentType];
  const root = await resolveLegalRoot();
  const raw = await readFile(path.join(root, filename), 'utf8');
  const meta = await resolveLegalPageMeta(documentType).catch(() => null);
  return applyLegalPlaceholders(raw, meta?.effectiveDate);
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
  const effectiveDate =
    doc?.effectiveDate
    ?? process.env.VERLOX_LEGAL_EFFECTIVE_DATE?.trim()
    ?? '2026-06-30';
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
