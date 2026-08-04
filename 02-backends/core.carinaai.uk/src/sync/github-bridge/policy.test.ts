import { describe, expect, it } from 'vitest';
import {
  contentLooksSecret,
  isDeniedPath,
  isUnderAllowedFolder,
  looksLikeEphemeralWorkingMemory,
  shouldCommitFile,
} from './policy.js';
import { DEFAULT_MANIFEST } from './types.js';
import { searchIndex, buildChunk, type IndexedChunk } from './index-store.js';

describe('github-bridge policy', () => {
  it('denies env and secret-like paths', () => {
    expect(isDeniedPath('.env')).toBe(true);
    expect(isDeniedPath('memory/agents/carina/.env.local')).toBe(true);
    expect(isDeniedPath('secrets/token.txt')).toBe(true);
    expect(isDeniedPath('memory/rules.md')).toBe(false);
  });

  it('allows only mounted folders', () => {
    expect(isUnderAllowedFolder('memory/rules.md', ['memory', 'skills'])).toBe(true);
    expect(isUnderAllowedFolder('plans/roadmap.md', ['memory'])).toBe(false);
    expect(isUnderAllowedFolder('AGENTS.md', ['AGENTS.md'])).toBe(true);
  });

  it('detects secrets and ephemeral dumps', () => {
    expect(contentLooksSecret('token=ghp_abcdefghijklmnopqrstuvwxyz012345')).toBe(true);
    expect(contentLooksSecret('User prefers concise answers.')).toBe(false);
    expect(looksLikeEphemeralWorkingMemory('{"role":"user","content":"hi"}')).toBe(true);
    expect(looksLikeEphemeralWorkingMemory('Carina prefers London timezone.')).toBe(false);
  });

  it('blocks commits outside write policy', () => {
    const ok = shouldCommitFile({
      relPath: 'memory/agents/carina/memory.md',
      content: 'Prefers short status updates.',
      allowedWriteFolders: DEFAULT_MANIFEST.writeFolders,
    });
    expect(ok.ok).toBe(true);

    const blocked = shouldCommitFile({
      relPath: 'AGENTS.md',
      content: 'do not change',
      allowedWriteFolders: DEFAULT_MANIFEST.writeFolders,
    });
    expect(blocked.ok).toBe(false);
  });
});

describe('github-bridge index search', () => {
  it('ranks path and token matches', () => {
    const chunks: IndexedChunk[] = [
      buildChunk({ path: 'memory/products.md', content: 'Scout monitors agents in production.' }),
      buildChunk({ path: 'memory/rules.md', content: 'Prefer verified facts only.' }),
    ];
    const hits = searchIndex({ version: 1, updatedAt: '', chunks }, 'scout agents', 5);
    expect(hits[0]?.path).toBe('memory/products.md');
    expect(hits[0]?.score).toBeGreaterThan(0);
  });
});
