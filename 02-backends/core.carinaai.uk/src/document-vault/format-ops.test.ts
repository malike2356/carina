import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  exportVaultItem,
  generatePdfArtifact,
  getDocumentVaultFormatCapabilities,
  importBytesIntoVault,
} from './format-ops.js';
import { DocumentVaultService } from './service.js';
import { LocalSandboxContentStore } from './content-store.js';

describe('Document vault format ops (709)', () => {
  let tmp: string;
  let vault: DocumentVaultService;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vault-fmt-'));
    vault = new DocumentVaultService(new LocalSandboxContentStore(path.join(tmp, 'blobs')), {
      dbPath: path.join(tmp, 'vault.db'),
    });
  });

  afterEach(() => {
    vault.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('imports markdown, exports pdf artifact linked to source revision, and keeps jobs', async () => {
    const caps = getDocumentVaultFormatCapabilities();
    expect(caps.formats.length).toBeGreaterThan(5);

    const imported = await importBytesIntoVault(vault, {
      workspaceId: 'ws-a',
      filename: 'brief.md',
      bytes: Buffer.from('# Brief\n\nHello world'),
    });
    expect(imported.item.kind).toBe('markdown');
    expect(imported.jobId).toBeTruthy();
    expect(vault.getJob('ws-a', imported.jobId)?.status).toBe('succeeded');

    const pdf = await generatePdfArtifact(vault, {
      workspaceId: 'ws-a',
      itemId: imported.item.id,
    });
    expect(pdf.extension).toBe('pdf');
    expect(pdf.artifactItemId).toBeTruthy();
    expect(pdf.sourceRevision).toBe(imported.item.currentRevision);
    const artifact = vault.getItem('ws-a', pdf.artifactItemId!);
    expect(artifact.kind).toBe('pdf');
    const bytes = await vault.readContent('ws-a', artifact.id);
    expect(bytes.subarray(0, 5).toString('utf8')).toBe('%PDF-');
  });

  it('fails closed on malicious upload and unsupported export', async () => {
    await expect(
      importBytesIntoVault(vault, {
        workspaceId: 'ws-a',
        filename: 'payload.zip',
        bytes: Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]),
      }),
    ).rejects.toThrow(/blocked|archive|Zip/i);

    const doc = await vault.createItem({
      workspaceId: 'ws-a',
      kind: 'plain_text',
      name: 'a.txt',
      content: 'hi',
    });
    await expect(
      exportVaultItem(vault, {
        workspaceId: 'ws-a',
        itemId: doc.id,
        targetFormat: 'pptx',
      }),
    ).rejects.toThrow(/not supported/i);
  });
});
