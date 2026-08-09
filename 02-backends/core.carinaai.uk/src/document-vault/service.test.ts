import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DocumentVaultService, VaultError } from './service.js';
import { LocalSandboxContentStore, ObjectStorageContentStore } from './content-store.js';

describe('DocumentVaultService (708)', () => {
  let tmp: string;
  let vault: DocumentVaultService;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vault-708-'));
    vault = new DocumentVaultService(new LocalSandboxContentStore(path.join(tmp, 'blobs')), {
      dbPath: path.join(tmp, 'vault.db'),
      defaultQuotaBytes: 1024 * 1024,
    });
  });

  afterEach(() => {
    vault.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('creates folders and files, lists with pagination, and isolates tenants', async () => {
    const folder = await vault.createItem({
      workspaceId: 'ws-a',
      kind: 'folder',
      name: 'Docs',
    });
    const doc = await vault.createItem({
      workspaceId: 'ws-a',
      parentId: folder.id,
      kind: 'markdown',
      name: 'Hello.md',
      content: '# hi',
    });
    await vault.createItem({
      workspaceId: 'ws-b',
      kind: 'plain_text',
      name: 'Secret',
      content: 'tenant-b',
    });

    const listed = vault.listItems('ws-a', { parentId: folder.id });
    expect(listed.total).toBe(1);
    expect(listed.items[0]?.id).toBe(doc.id);
    expect(() => vault.getItem('ws-b', doc.id)).toThrowError(VaultError);
    expect(() => vault.getItem('ws-a', 'missing')).toThrowError(/not found/i);
  });

  it('rejects cycles, path traversal parents, and cross-workspace parents', async () => {
    const root = await vault.createItem({ workspaceId: 'ws-a', kind: 'folder', name: 'Root' });
    const child = await vault.createItem({
      workspaceId: 'ws-a',
      parentId: root.id,
      kind: 'folder',
      name: 'Child',
    });
    expect(() => vault.move('ws-a', root.id, child.id)).toThrowError(/descendant|cycle/i);
    expect(() => vault.move('ws-a', root.id, root.id)).toThrowError(/itself|cycle/i);

    await expect(
      vault.createItem({
        workspaceId: 'ws-a',
        parentId: '../etc',
        kind: 'plain_text',
        name: 'x',
        content: 'nope',
      }),
    ).rejects.toThrow(/Invalid parent|not found/i);

    const other = await vault.createItem({ workspaceId: 'ws-b', kind: 'folder', name: 'Other' });
    await expect(
      vault.createItem({
        workspaceId: 'ws-a',
        parentId: other.id,
        kind: 'plain_text',
        name: 'leak',
        content: 'x',
      }),
    ).rejects.toThrow(/Parent not found|Cross-workspace/i);
  });

  it('updates with optimistic revision checks, append, and revision restore', async () => {
    const doc = await vault.createItem({
      workspaceId: 'ws-a',
      kind: 'plain_text',
      name: 'note',
      content: 'v1',
    });
    const v2 = await vault.updateContent('ws-a', doc.id, 'v2', { expectedRevision: 1 });
    expect(v2.currentRevision).toBe(2);
    await expect(
      vault.updateContent('ws-a', doc.id, 'stale', { expectedRevision: 1 }),
    ).rejects.toThrow(/Stale revision/i);

    await vault.updateContent('ws-a', doc.id, '!', { mode: 'append', expectedRevision: 2 });
    expect((await vault.readContent('ws-a', doc.id)).toString('utf8')).toBe('v2!');

    const revs = vault.listRevisions('ws-a', doc.id);
    expect(revs.length).toBeGreaterThanOrEqual(3);
    await vault.restoreRevision('ws-a', doc.id, 1);
    expect((await vault.readContent('ws-a', doc.id)).toString('utf8')).toBe('v1');
  });

  it('trashes recursively and restores into Recovery when parent is gone', async () => {
    const folder = await vault.createItem({ workspaceId: 'ws-a', kind: 'folder', name: 'Tree' });
    const nested = await vault.createItem({
      workspaceId: 'ws-a',
      parentId: folder.id,
      kind: 'plain_text',
      name: 'leaf',
      content: 'x',
    });
    vault.trash('ws-a', folder.id);
    expect(vault.getItem('ws-a', folder.id).trashedAt).toBeTruthy();
    expect(vault.getItem('ws-a', nested.id).trashedAt).toBeTruthy();

    expect(() => vault.permanentDelete('ws-a', folder.id)).toThrowError(/approval/i);
    const { token } = vault.requestDestructiveApproval('ws-a', 'permanent_delete', [folder.id]);
    vault.permanentDelete('ws-a', folder.id, { approvalToken: token });
    expect(() => vault.getItem('ws-a', folder.id)).toThrowError(/not found/i);

    const parent = await vault.createItem({ workspaceId: 'ws-a', kind: 'folder', name: 'P' });
    const child = await vault.createItem({
      workspaceId: 'ws-a',
      parentId: parent.id,
      kind: 'plain_text',
      name: 'c',
      content: 'y',
    });
    vault.trash('ws-a', child.id);
    vault.trash('ws-a', parent.id);
    const restored = vault.restore('ws-a', child.id);
    expect(restored.parentId).toBeTruthy();
    expect(vault.getItem('ws-a', restored.parentId!).name).toBe('Recovery');
  });

  it('enforces quota', async () => {
    const tiny = new DocumentVaultService(new LocalSandboxContentStore(path.join(tmp, 'q')), {
      dbPath: path.join(tmp, 'q.db'),
      defaultQuotaBytes: 10,
    });
    await expect(
      tiny.createItem({
        workspaceId: 'ws-a',
        kind: 'plain_text',
        name: 'big',
        content: '01234567890123456789',
      }),
    ).rejects.toThrow(/quota/i);
    tiny.close();
  });

  it('rejects unsafe sandbox paths and supports object storage adapter', async () => {
    const store = new LocalSandboxContentStore(path.join(tmp, 'safe'));
    await expect(store.put('ws', '../escape', 1, Buffer.from('x'))).rejects.toThrow(
      /Invalid|unsafe|escaped/i,
    );
    const objectStore = new ObjectStorageContentStore('bucket');
    const put = await objectStore.put('ws-a', 'item-1', 1, Buffer.from('hello'));
    expect(put.locator.scheme).toBe('object');
    expect((await objectStore.get(put.locator)).toString('utf8')).toBe('hello');
  });

  it('copies trees and renames without path traversal names', async () => {
    const folder = await vault.createItem({ workspaceId: 'ws-a', kind: 'folder', name: 'Src' });
    await vault.createItem({
      workspaceId: 'ws-a',
      parentId: folder.id,
      kind: 'plain_text',
      name: 'a',
      content: '1',
    });
    const copied = await vault.copy('ws-a', folder.id, null);
    expect(copied.name).toContain('copy');
    const kids = vault.listItems('ws-a', { parentId: copied.id });
    expect(kids.total).toBe(1);
    const renamed = vault.rename('ws-a', copied.id, '../evil');
    expect(renamed.name).not.toContain('..');
    expect(renamed.name).not.toContain('/');
  });
});
