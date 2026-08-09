import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDefaultContentStore } from '../content-store.js';
import { DocumentVaultService, VaultError } from '../service.js';
import { setDocumentVaultToolServiceForTests } from '../runtime.js';
import {
  CHANNEL_MATRIX,
  bindChannelIdentity,
  channelSupportsFiles,
  handleVaultChannelCommand,
  importChannelAttachment,
  looksLikeVaultImportCaption,
  planExportDelivery,
  resolveChannelBinding,
  revokeChannelBinding,
  type ChannelAttachment,
} from './index.js';

describe('document vault channel ops (713)', () => {
  let tmp: string;
  let svc: DocumentVaultService;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'vault-channel-'));
    svc = new DocumentVaultService(createDefaultContentStore(join(tmp, 'content')), {
      dbPath: join(tmp, 'vault.sqlite'),
    });
    setDocumentVaultToolServiceForTests(svc);
    process.env.DOCUMENT_VAULT_CHANNEL_OPS = '1';
    process.env.CARINA_DOCUMENT_VAULT_SOFT_WALL = '1';
    bindChannelIdentity({
      workspaceId: 'ws-a',
      platform: 'telegram',
      channelUserId: 'tg-user-1',
      actorId: 'actor-1',
      service: svc,
    });
  });

  afterEach(() => {
    setDocumentVaultToolServiceForTests(null);
    rmSync(tmp, { recursive: true, force: true });
  });

  it('channel matrix includes telegram and excludes sms files', () => {
    expect(channelSupportsFiles('telegram')).toBe(true);
    expect('slack' in CHANNEL_MATRIX).toBe(true);
    expect(channelSupportsFiles('sms')).toBe(false);
  });

  it('unbound and revoked fail closed', () => {
    expect(() => resolveChannelBinding('telegram', 'unknown-user', { service: svc })).toThrow(
      VaultError,
    );
    try {
      resolveChannelBinding('telegram', 'unknown-user', { service: svc });
    } catch (err) {
      expect(err).toMatchObject({ code: 'channel_unbound' });
    }
    revokeChannelBinding('telegram', 'tg-user-1', { service: svc });
    try {
      resolveChannelBinding('telegram', 'tg-user-1', { service: svc });
      expect.fail('expected revoke to fail closed');
    } catch (err) {
      expect(err).toMatchObject({ code: 'channel_revoked' });
    }
  });

  it('import deduplicates the same event_id', async () => {
    const att: ChannelAttachment = {
      platform: 'telegram',
      channelUserId: 'tg-user-1',
      eventId: 'msg-100',
      filename: 'note.md',
      data: Buffer.from('# hello vault\n', 'utf8'),
      declaredMime: 'text/markdown',
    };
    const first = await importChannelAttachment(att, { service: svc });
    expect(first.ok).toBe(true);
    expect(first.itemId).toBeTruthy();
    expect(first.deduplicated).toBeFalsy();
    const second = await importChannelAttachment(att, { service: svc });
    expect(second.ok).toBe(true);
    expect(second.deduplicated).toBe(true);
    expect(second.itemId).toBe(first.itemId);
  });

  it('rejects MIME spoofing', async () => {
    const att: ChannelAttachment = {
      platform: 'telegram',
      channelUserId: 'tg-user-1',
      eventId: 'msg-spoof',
      filename: 'readme.txt',
      data: Buffer.from('%PDF-1.4 fake', 'utf8'),
      declaredMime: 'text/plain',
    };
    await expect(importChannelAttachment(att, { service: svc })).rejects.toBeInstanceOf(VaultError);
  });

  it('rejects oversized attachments', async () => {
    const att: ChannelAttachment = {
      platform: 'telegram',
      channelUserId: 'tg-user-1',
      eventId: 'msg-big',
      filename: 'big.md',
      data: Buffer.alloc(21 * 1024 * 1024, 1),
      declaredMime: 'text/markdown',
    };
    await expect(importChannelAttachment(att, { service: svc })).rejects.toMatchObject({
      code: 'quota',
    });
  });

  it('cross-user cannot use another binding', async () => {
    const att: ChannelAttachment = {
      platform: 'telegram',
      channelUserId: 'other-user',
      eventId: 'msg-x',
      filename: 'x.md',
      data: Buffer.from('x', 'utf8'),
    };
    await expect(importChannelAttachment(att, { service: svc })).rejects.toMatchObject({
      code: 'channel_unbound',
    });
  });

  it('slash create and list use binding workspace; forged workspace fails closed', async () => {
    const forged = await handleVaultChannelCommand({
      text: '/vault list',
      platform: 'telegram',
      channelUserId: 'tg-user-1',
      workspaceId: 'forged-ws',
      service: svc,
    });
    expect(forged.ok).toBe(false);
    expect(forged.message).toMatch(/another workspace|forbidden/i);

    const created = await handleVaultChannelCommand({
      text: '/vault create notes.md hello',
      platform: 'telegram',
      channelUserId: 'tg-user-1',
      workspaceId: 'ws-a',
      service: svc,
    });
    expect(created.ok).toBe(true);
    const listed = await handleVaultChannelCommand({
      text: '/vault list',
      platform: 'telegram',
      channelUserId: 'tg-user-1',
      workspaceId: 'ws-a',
      service: svc,
    });
    expect(listed.ok).toBe(true);
    expect(listed.message).toMatch(/notes\.md|markdown/i);
  });

  it('unbound slash is denied', async () => {
    const result = await handleVaultChannelCommand({
      text: '/vault list',
      platform: 'telegram',
      channelUserId: 'nobody',
      service: svc,
    });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/unbound|binding/i);
  });

  it('export plans attach for small files and soft-walls classified', async () => {
    const item = await svc.createItem(
      {
        workspaceId: 'ws-a',
        kind: 'markdown',
        name: 'tiny.md',
        content: 'hi',
      },
      { actorId: 'actor-1' },
    );
    const ctx = resolveChannelBinding('telegram', 'tg-user-1', { service: svc });
    const planned = await planExportDelivery(ctx, item.id, { service: svc, format: 'markdown' });
    expect(planned.ok).toBe(true);
    expect(planned.mode).toBe('attach');

    const classified = await svc.createItem(
      {
        workspaceId: 'ws-a',
        kind: 'markdown',
        name: 'secret.md',
        content: 'top secret',
        classification: 'confidential',
      },
      { actorId: 'actor-1' },
    );
    const blocked = await planExportDelivery(ctx, classified.id, { service: svc });
    expect(blocked.blocked).toBe(true);
  });

  it('detects vault import captions', () => {
    expect(looksLikeVaultImportCaption('/vault import')).toBe(true);
    expect(looksLikeVaultImportCaption('please save this to vault')).toBe(true);
    expect(looksLikeVaultImportCaption('hello')).toBe(false);
  });
});
