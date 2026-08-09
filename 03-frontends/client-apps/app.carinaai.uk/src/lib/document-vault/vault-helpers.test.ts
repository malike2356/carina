import { describe, expect, it } from 'vitest';
import {
  isTextEditableKind,
  kindLabel,
  sanitizeVaultName,
  validateVaultMove,
  vaultEditorHref,
} from '@/lib/document-vault/vault-helpers';

describe('document vault helpers', () => {
  it('sanitizes names and rejects traversal tokens', () => {
    expect(sanitizeVaultName('  a/b\\c  ')).toBe('a_b_c');
    expect(sanitizeVaultName('..')).toBe('Untitled');
    expect(sanitizeVaultName('.')).toBe('Untitled');
    expect(sanitizeVaultName('')).toBe('Untitled');
  });

  it('rejects invalid moves used by optimistic DnD', () => {
    expect(
      validateVaultMove({
        itemId: 'folder-a',
        newParentId: 'folder-a',
        descendantIds: [],
      }).ok,
    ).toBe(false);

    expect(
      validateVaultMove({
        itemId: 'folder-a',
        newParentId: 'child',
        parent: { kind: 'folder', trashedAt: null },
        descendantIds: ['child'],
      }).ok,
    ).toBe(false);

    expect(
      validateVaultMove({
        itemId: 'doc-1',
        newParentId: 'folder-b',
        parent: { kind: 'markdown', trashedAt: null },
        descendantIds: [],
      }).ok,
    ).toBe(false);

    expect(
      validateVaultMove({
        itemId: 'doc-1',
        newParentId: 'folder-b',
        parent: { kind: 'folder', trashedAt: null },
        descendantIds: [],
      }),
    ).toEqual({ ok: true });

    expect(
      validateVaultMove({
        itemId: 'doc-1',
        newParentId: null,
        descendantIds: [],
      }),
    ).toEqual({ ok: true });
  });

  it('maps editor hrefs and editable kinds', () => {
    expect(vaultEditorHref({ id: 'f1', kind: 'folder' })).toBeNull();
    expect(vaultEditorHref({ id: 'd1', kind: 'html' })).toBe('/documents/d1');
    expect(isTextEditableKind('spreadsheet')).toBe(true);
    expect(isTextEditableKind('pdf')).toBe(false);
    expect(kindLabel('rich_document')).toBe('Document');
  });

  it('keeps tenant ids opaque in hrefs (isolation contract)', () => {
    const href = vaultEditorHref({ id: '11111111-1111-1111-1111-111111111111', kind: 'markdown' });
    expect(href).toBe('/documents/11111111-1111-1111-1111-111111111111');
    expect(href).not.toContain('workspace');
  });
});
