import { describe, expect, it, beforeAll } from 'vitest';
import { buildPlatformKnowledgeContext, loadPlatformKnowledge } from './knowledge.js';

describe('platform knowledge', () => {
  beforeAll(async () => {
    await loadPlatformKnowledge();
  });

  it('loads platform-knowledge.md', async () => {
    const body = await loadPlatformKnowledge();
    expect(body).toContain('Monorepo root');
    expect(body).toContain('carinaMobile/');
    expect(body).toContain('Tavily');
  });

  it('builds runtime context wrapper', () => {
    const ctx = buildPlatformKnowledgeContext();
    expect(ctx).toMatch(/^Platform scope/);
    expect(ctx).toContain('general-purpose by default');
    expect(ctx).toContain('carinaMobile/');
  });
});
