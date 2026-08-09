/** Document Vault item kinds and MIME normalization (prompt 708). */

export const VAULT_ITEM_KINDS = [
  'folder',
  'rich_document',
  'spreadsheet',
  'presentation',
  'markdown',
  'html',
  'plain_text',
  'pdf',
  'binary_upload',
] as const;

export type VaultItemKind = (typeof VAULT_ITEM_KINDS)[number];

export type ContentAuthority = 'workspace' | 'google';

export type IndexPolicy = 'inherit' | 'index' | 'no_index';

export type Classification = 'internal' | 'confidential' | 'public_ready' | 'restricted';

const KIND_MIME: Record<VaultItemKind, string> = {
  folder: 'application/vnd.carina.folder',
  rich_document: 'application/vnd.carina.rich-document',
  spreadsheet: 'application/vnd.carina.spreadsheet',
  presentation: 'application/vnd.carina.presentation',
  markdown: 'text/markdown',
  html: 'text/html',
  plain_text: 'text/plain',
  pdf: 'application/pdf',
  binary_upload: 'application/octet-stream',
};

const EXT_KIND: Record<string, VaultItemKind> = {
  md: 'markdown',
  markdown: 'markdown',
  html: 'html',
  htm: 'html',
  txt: 'plain_text',
  pdf: 'pdf',
  csv: 'spreadsheet',
  json: 'plain_text',
  docx: 'rich_document',
  xlsx: 'spreadsheet',
  pptx: 'presentation',
};

export function isVaultItemKind(value: string): value is VaultItemKind {
  return (VAULT_ITEM_KINDS as readonly string[]).includes(value);
}

export function defaultMimeForKind(kind: VaultItemKind): string {
  return KIND_MIME[kind];
}

export function extensionForKind(kind: VaultItemKind): string | null {
  switch (kind) {
    case 'folder':
      return null;
    case 'markdown':
      return 'md';
    case 'html':
      return 'html';
    case 'plain_text':
      return 'txt';
    case 'pdf':
      return 'pdf';
    case 'spreadsheet':
      return 'csv';
    case 'rich_document':
      return 'docx';
    case 'presentation':
      return 'pptx';
    case 'binary_upload':
      return 'bin';
    default:
      return null;
  }
}

export function kindFromFormatOrExtension(
  formatOrExt: string | undefined,
  fallback: VaultItemKind = 'plain_text',
): VaultItemKind {
  const raw = String(formatOrExt ?? '').trim().toLowerCase().replace(/^\./, '');
  if (!raw) return fallback;
  if (raw === 'plain') return 'plain_text';
  if (isVaultItemKind(raw)) return raw;
  return EXT_KIND[raw] ?? fallback;
}

export function sanitizeVaultFileName(name: string): string {
  const trimmed = name.trim().replace(/[\u0000-\u001f\\/]/g, '_');
  if (!trimmed || trimmed === '.' || trimmed === '..') return 'Untitled';
  if (trimmed.includes('..')) return trimmed.replace(/\.\./g, '_');
  return trimmed.slice(0, 255);
}

export function normalizeVaultName(name: string): string {
  return sanitizeVaultFileName(name).toLowerCase();
}
