import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getBinding: vi.fn(),
  listFolders: vi.fn(),
  extractDocumentText: vi.fn(),
  insertKnowledgeDocument: vi.fn(),
  truncateDocumentText: vi.fn((text: string) => text.slice(0, 20_000)),
  pushDocumentToDrive: vi.fn(),
}));

vi.mock('./store.js', () => ({
  getBinding: mocks.getBinding,
  listFolders: mocks.listFolders,
}));

vi.mock('../../workers/knowledge-base.js', () => ({
  DOC_CHAR_LIMIT: 20_000,
  extractDocumentText: mocks.extractDocumentText,
  insertKnowledgeDocument: mocks.insertKnowledgeDocument,
  truncateDocumentText: mocks.truncateDocumentText,
}));

vi.mock('./browse.js', () => ({
  isFolderAllowedInOpsTree: vi.fn(async () => true),
}));

vi.mock('./drive-client.js', () => ({
  resolveWorkerDriveToken: vi.fn(async () => 'token'),
}));

vi.mock('./sync-engine.js', () => ({
  pushDocumentToDrive: mocks.pushDocumentToDrive,
}));

import { uploadOpsDocumentFromFile } from './upload.js';

describe('uploadOpsDocumentFromFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getBinding.mockResolvedValue({
      id: 'bind-1',
      workspaceId: 'ws-1',
      workerId: 'worker-1',
      rootFolderId: 'root-1',
    });
    mocks.listFolders.mockResolvedValue([
      { category: 'inbox', folderId: 'folder-inbox' },
      { category: 'policies', folderId: 'folder-policies' },
    ]);
    mocks.extractDocumentText.mockResolvedValue('Policy text for learning');
    mocks.insertKnowledgeDocument.mockResolvedValue({
      id: 'doc-1',
      title: 'safeguarding',
      content: 'Policy text for learning',
      enabled: true,
      charCount: 24,
    });
    mocks.pushDocumentToDrive.mockResolvedValue(undefined);
  });

  it('stores enabled knowledge and pushes to Drive', async () => {
    const data = Buffer.from('hello').toString('base64');
    const result = await uploadOpsDocumentFromFile({
      workspaceId: 'ws-1',
      workerId: 'worker-1',
      filename: 'safeguarding.txt',
      data,
      category: 'policies',
    });

    expect(mocks.insertKnowledgeDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        workerId: 'worker-1',
        workspaceId: 'ws-1',
        title: 'safeguarding',
        enabled: true,
        countTowardLimit: true,
      }),
    );
    expect(mocks.pushDocumentToDrive).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: 'doc-1',
        category: 'policies',
      }),
    );
    expect(result.drivePushed).toBe(true);
    expect(result.learnedByAiva).toBe(true);
    expect(result.category).toBe('policies');
  });

  it('keeps vault doc when Drive push fails', async () => {
    mocks.pushDocumentToDrive.mockRejectedValue(new Error('Drive offline'));
    const data = Buffer.from('hello').toString('base64');
    const result = await uploadOpsDocumentFromFile({
      workspaceId: 'ws-1',
      workerId: 'worker-1',
      filename: 'notes.txt',
      data,
    });
    expect(result.document.id).toBe('doc-1');
    expect(result.drivePushed).toBe(false);
    expect(result.learnedByAiva).toBe(true);
  });

  it('requires bootstrapped Ops pack', async () => {
    mocks.getBinding.mockResolvedValue(null);
    await expect(
      uploadOpsDocumentFromFile({
        workspaceId: 'ws-1',
        workerId: 'worker-1',
        filename: 'a.txt',
        data: Buffer.from('x').toString('base64'),
      }),
    ).rejects.toThrow(/bootstrapped/i);
  });
});
