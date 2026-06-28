import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  listRagSources: vi.fn(),
  deleteRagSource: vi.fn(),
  isSourceIngested: vi.fn(),
  insertRagChunkWithWorkspace: vi.fn(),
  embed: vi.fn(),
  embeddingProviderStatus: vi.fn(),
  extractFromBuffer: vi.fn(),
  initDb: vi.fn(),
}));

vi.mock('../../memory/db.js', () => ({
  initDb: mocks.initDb,
}));

vi.mock('../../memory/store.js', () => ({
  listRagSources: mocks.listRagSources,
  deleteRagSource: mocks.deleteRagSource,
  isSourceIngested: mocks.isSourceIngested,
  insertRagChunkWithWorkspace: mocks.insertRagChunkWithWorkspace,
  searchRag: vi.fn(async () => []),
}));

vi.mock('../../memory/embeddings.js', () => ({
  embed: mocks.embed,
  embeddingProviderStatus: mocks.embeddingProviderStatus,
}));

vi.mock('../../memory/rag-extractors.js', () => ({
  extractFromBuffer: mocks.extractFromBuffer,
}));

vi.mock('../../memory/chunk-text.js', () => ({
  chunkAuto: vi.fn(() => ['chunk one', 'chunk two']),
}));

import { runRagCommand } from './rag-cli.js';

describe('runRagCommand', () => {
  let tmpDir: string;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'carina-rag-cli-'));
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);
    vi.clearAllMocks();
    mocks.initDb.mockResolvedValue(undefined);
    mocks.embeddingProviderStatus.mockReturnValue({ active: 'openai', configured: ['openai'] });
    mocks.embed.mockResolvedValue([0.1, 0.2]);
    mocks.insertRagChunkWithWorkspace.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
    exitSpy.mockRestore();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('list prints a formatted table', async () => {
    mocks.listRagSources.mockResolvedValue({
      sources: [
        {
          source: 'file:RAG-001-identity.md',
          pack: 'carina-rag',
          chunkCount: 5,
          ingestedAt: '2026-06-26T10:00:00.000Z',
        },
      ],
      total: 1,
    });

    await runRagCommand(['list', '--pack', 'carina-rag']);

    expect(mocks.listRagSources).toHaveBeenCalledWith(null, 'carina-rag', 50, 0);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('SOURCE'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('file:RAG-001-identity.md'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Total: 1 sources'));
  });

  it('delete prints the deletion count', async () => {
    mocks.deleteRagSource.mockResolvedValue(3);

    await runRagCommand(['delete', 'file:RAG-001-identity.md']);

    expect(mocks.deleteRagSource).toHaveBeenCalledWith('file:RAG-001-identity.md', null);
    expect(logSpy).toHaveBeenCalledWith('Deleted 3 chunks for source: file:RAG-001-identity.md');
  });

  it('upload ingests a markdown file', async () => {
    const filePath = path.join(tmpDir, 'sample.md');
    await fs.writeFile(filePath, '# Sample\n\nHello world.');
    mocks.isSourceIngested.mockResolvedValue(false);
    mocks.extractFromBuffer.mockResolvedValue('# Sample\n\nHello world.');

    await runRagCommand(['upload', filePath, '--pack', 'carina-rag']);

    expect(mocks.isSourceIngested).toHaveBeenCalledWith('file:sample.md');
    expect(mocks.insertRagChunkWithWorkspace).toHaveBeenCalledTimes(2);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Ingested 2 chunks'));
  });

  it('upload skips already-ingested sources unless forced', async () => {
    const filePath = path.join(tmpDir, 'sample.md');
    await fs.writeFile(filePath, 'content');
    mocks.isSourceIngested.mockResolvedValue(true);

    await runRagCommand(['upload', filePath, '--pack', 'carina-rag']);

    expect(logSpy).toHaveBeenCalledWith('Already ingested: file:sample.md. Use --force to re-ingest.');
    expect(mocks.insertRagChunkWithWorkspace).not.toHaveBeenCalled();
  });

  it('upload with --force deletes then re-ingests', async () => {
    const filePath = path.join(tmpDir, 'sample.md');
    await fs.writeFile(filePath, 'content');
    mocks.isSourceIngested.mockResolvedValue(true);
    mocks.deleteRagSource.mockResolvedValue(4);
    mocks.extractFromBuffer.mockResolvedValue('content');

    await runRagCommand(['upload', filePath, '--pack', 'carina-rag', '--force']);

    expect(mocks.deleteRagSource).toHaveBeenCalledWith('file:sample.md', null);
    expect(mocks.insertRagChunkWithWorkspace).toHaveBeenCalledTimes(2);
  });
});
