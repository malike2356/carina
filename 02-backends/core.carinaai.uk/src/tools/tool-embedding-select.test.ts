import { describe, expect, it, vi } from 'vitest';
import type { Tool } from '../types/index.js';
import {
  clearToolEmbeddingCacheForTests,
  embeddingToolSelectMinTools,
  selectToolsByEmbedding,
  shouldUseEmbeddingToolSelect,
} from './tool-embedding-select.js';

vi.mock('../memory/embeddings.js', () => ({
  embed: vi.fn(async (text: string) => {
    if (text.includes('file-read')) return [1, 0, 0];
    if (text.includes('web-search')) return [0, 1, 0];
    if (text.includes('read file')) return [0.9, 0.1, 0];
    return [0, 0, 1];
  }),
}));

function tool(name: string, description: string): Tool {
  return {
    name,
    description,
    parameters: { type: 'object', properties: {} },
    execute: async () => ({}),
  };
}

describe('tool-embedding-select', () => {
  it('selects tools relevant to the user query', async () => {
    clearToolEmbeddingCacheForTests();
    const tools = [
      tool('file-read', 'Read file contents from disk'),
      tool('web-search', 'Search the live web'),
      tool('todo', 'Track multi-step tasks'),
    ];

    const selected = await selectToolsByEmbedding({
      tools,
      query: 'read file config.json',
      topK: 2,
      alwaysInclude: ['todo'],
    });

    const names = selected.map((t) => t.name);
    expect(names).toContain('todo');
    expect(names).toContain('file-read');
    expect(names).not.toContain('web-search');
  });

  it('activates for local models or large tool sets', () => {
    process.env.CARINA_TOOL_EMBED_SELECT = 'false';
    expect(shouldUseEmbeddingToolSelect({ toolCount: 30, contextWindow: 200_000 })).toBe(false);

    process.env.CARINA_TOOL_EMBED_SELECT = 'true';
    expect(shouldUseEmbeddingToolSelect({ toolCount: embeddingToolSelectMinTools() })).toBe(true);
    delete process.env.CARINA_TOOL_EMBED_SELECT;
  });
});
