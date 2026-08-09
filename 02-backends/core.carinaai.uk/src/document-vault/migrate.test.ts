import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { migrateLegacyDocumentsToVault } from './migrate.js';
import { sha256Hex } from './model.js';
import { DocumentVaultService } from './service.js';
import { LocalSandboxContentStore } from './content-store.js';

describe('Document vault migration (708)', () => {
  let tmp: string;
  let vault: DocumentVaultService;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vault-mig-'));
    vault = new DocumentVaultService(new LocalSandboxContentStore(path.join(tmp, 'blobs')), {
      dbPath: path.join(tmp, 'vault.db'),
    });
    process.env.DOCUMENT_VAULT_MIGRATE_DRY_RUN = 'false';
  });

  afterEach(() => {
    vault.close();
    fs.rmSync(tmp, { recursive: true, force: true });
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) delete process.env[key];
    }
    Object.assign(process.env, originalEnv);
  });

  it('imports cloud documents idempotently with checksum reconciliation', async () => {
    const batch = {
      workspaceId: 'ws-a',
      cloudDocuments: [
        {
          id: '11111111-1111-1111-1111-111111111111',
          workspaceId: 'ws-a',
          title: 'Pitch',
          content: 'Hello',
          format: 'markdown',
        },
      ],
    };

    const first = await migrateLegacyDocumentsToVault(vault, batch, { dryRun: false });
    expect(first.imported).toBe(1);
    expect(first.checksumOk).toBe(1);
    const item = vault.getItem('ws-a', batch.cloudDocuments[0]!.id);
    expect(item.name).toBe('Pitch');
    expect(item.checksum).toBe(sha256Hex('Hello'));

    const second = await migrateLegacyDocumentsToVault(vault, batch, { dryRun: false });
    expect(second.imported).toBe(0);
    expect(second.skipped).toBe(1);
    expect(second.checksumOk).toBe(1);

    const listed = vault.listItems('ws-a', { parentId: null });
    expect(listed.total).toBe(1);
  });

  it('dry-run does not write rows and re-run apply stays safe', async () => {
    const batch = {
      workspaceId: 'ws-a',
      cloudDocuments: [
        {
          id: '22222222-2222-2222-2222-222222222222',
          workspaceId: 'ws-a',
          title: 'Dry',
          content: 'x',
          format: 'plain',
        },
      ],
    };
    const dry = await migrateLegacyDocumentsToVault(vault, batch, { dryRun: true });
    expect(dry.mode).toBe('dry_run');
    expect(dry.imported).toBe(1);
    expect(() => vault.getItem('ws-a', batch.cloudDocuments[0]!.id)).toThrow(/not found/i);

    const applied = await migrateLegacyDocumentsToVault(vault, batch, { dryRun: false });
    expect(applied.imported).toBe(1);
    const again = await migrateLegacyDocumentsToVault(vault, batch, { dryRun: false });
    expect(again.skipped).toBe(1);
  });

  it('skips cross-tenant rows and never imports host operator store', async () => {
    const result = await migrateLegacyDocumentsToVault(
      vault,
      {
        workspaceId: 'ws-a',
        cloudDocuments: [
          {
            id: '33333333-3333-3333-3333-333333333333',
            workspaceId: 'ws-b',
            title: 'Leak',
            content: 'nope',
          },
        ],
        knowledgeDocuments: [
          {
            id: '44444444-4444-4444-4444-444444444444',
            workspaceId: 'ws-a',
            title: 'KB',
            content: 'body',
          },
        ],
      },
      { dryRun: false },
    );
    expect(result.skipped).toBeGreaterThanOrEqual(1);
    expect(result.imported).toBe(1);
    expect(vault.getItem('ws-a', '44444444-4444-4444-4444-444444444444').name).toBe('KB');
  });

  it('rolls back applied mappings without duplicating on re-import', async () => {
    const batch = {
      workspaceId: 'ws-a',
      cloudDocuments: [
        {
          id: '55555555-5555-5555-5555-555555555555',
          workspaceId: 'ws-a',
          title: 'Temp',
          content: 'z',
          format: 'html',
        },
      ],
    };
    await migrateLegacyDocumentsToVault(vault, batch, { dryRun: false });
    const rolled = await migrateLegacyDocumentsToVault(vault, batch, {
      dryRun: false,
      rollbackApplied: true,
    });
    expect(rolled.rolledBack).toBe(true);
    expect(() => vault.getItem('ws-a', batch.cloudDocuments[0]!.id)).toThrow(/not found/i);

    const reimport = await migrateLegacyDocumentsToVault(vault, batch, { dryRun: false });
    expect(reimport.imported).toBe(1);
    expect(vault.listItems('ws-a').total).toBe(1);
  });
});
