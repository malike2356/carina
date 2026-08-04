import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { documentsManageTool } from './documents-manage.js';
import {
  configureDocumentsStore,
  resetDocumentsStore,
} from '../gateway/documents-store.js';

describe('documents-manage', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-docs-tool-'));
    configureDocumentsStore({ dbPath: path.join(tmpDir, 'docs.db') });
  });

  afterEach(() => {
    resetDocumentsStore();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates and lists documents', async () => {
    const created = await documentsManageTool.execute({
      action: 'create',
      title: 'Spec',
      content: '# Hello',
      format: 'markdown',
    }) as { document: { id: string; title: string } };
    expect(created.document.title).toBe('Spec');

    const listed = await documentsManageTool.execute({ action: 'list' }) as {
      count: number;
      documents: Array<{ id: string }>;
    };
    expect(listed.count).toBe(1);
    expect(listed.documents[0]?.id).toBe(created.document.id);
  });

  it('gets and updates a document', async () => {
    const created = await documentsManageTool.execute({
      action: 'create',
      title: 'Draft',
      content: 'v1',
    }) as { document: { id: string } };

    const fetched = await documentsManageTool.execute({
      action: 'get',
      id: created.document.id,
    }) as { document: { content: string } };
    expect(fetched.document.content).toBe('v1');

    const updated = await documentsManageTool.execute({
      action: 'update',
      id: created.document.id,
      content: 'v2',
    }) as { document: { content: string } };
    expect(updated.document.content).toBe('v2');
  });

  it('deletes a document', async () => {
    const created = await documentsManageTool.execute({
      action: 'create',
      title: 'Temp',
    }) as { document: { id: string } };

    const deleted = await documentsManageTool.execute({
      action: 'delete',
      id: created.document.id,
    }) as { status: string };
    expect(deleted.status).toBe('deleted');
  });
});
