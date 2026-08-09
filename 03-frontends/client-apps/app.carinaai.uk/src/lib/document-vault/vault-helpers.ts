/** Pure Document Vault helpers (no DB). Used by UI and unit tests. */

export function sanitizeVaultName(name: string): string {
  const trimmed = name.trim().replace(/[\u0000-\u001f\\/]/g, '_');
  if (!trimmed || trimmed === '.' || trimmed === '..') return 'Untitled';
  return trimmed.replace(/\.\./g, '_').slice(0, 255);
}

export type MoveValidationInput = {
  itemId: string;
  newParentId: string | null;
  parent?: { kind: string; trashedAt: string | null } | null;
  descendantIds: string[];
};

/** Mirror server move rules for optimistic UI rollback decisions. */
export function validateVaultMove(input: MoveValidationInput): { ok: true } | { ok: false; error: string } {
  const { itemId, newParentId, parent, descendantIds } = input;
  if (newParentId === itemId) {
    return { ok: false, error: 'Cannot move item into itself' };
  }
  if (newParentId) {
    if (!parent || parent.kind !== 'folder' || parent.trashedAt) {
      return { ok: false, error: 'Parent folder not found' };
    }
    if (descendantIds.includes(newParentId)) {
      return { ok: false, error: 'Cannot move folder into its descendant' };
    }
  }
  return { ok: true };
}

export function vaultEditorHref(item: { id: string; kind: string }): string | null {
  if (item.kind === 'folder') return null;
  return `/documents/${item.id}`;
}

export function isTextEditableKind(kind: string): boolean {
  return (
    kind === 'markdown' ||
    kind === 'html' ||
    kind === 'plain_text' ||
    kind === 'rich_document' ||
    kind === 'spreadsheet' ||
    kind === 'presentation'
  );
}

export function kindLabel(kind: string): string {
  switch (kind) {
    case 'folder':
      return 'Folder';
    case 'markdown':
      return 'Markdown';
    case 'html':
    case 'rich_document':
      return 'Document';
    case 'plain_text':
      return 'Text';
    case 'spreadsheet':
      return 'Spreadsheet';
    case 'presentation':
      return 'Presentation';
    case 'pdf':
      return 'PDF';
    case 'binary_upload':
      return 'File';
    default:
      return kind;
  }
}
