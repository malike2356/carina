import { describe, expect, it, beforeAll } from 'vitest';
import {
  buildPlatformKnowledgeContext,
  loadPlatformKnowledge,
  loadPlatformState,
} from './knowledge.js';

describe('platform knowledge', () => {
  beforeAll(async () => {
    await loadPlatformKnowledge();
  });

  it('loads platform-knowledge.md', async () => {
    const body = await loadPlatformKnowledge();
    expect(body).toContain('Monorepo root');
    expect(body).toContain('01-devends/');
    expect(body).toContain('02-backends/');
    expect(body).toContain('03-frontends/');
    expect(body).toContain('Tavily');
    expect(body).toContain('Aiva');
  });

  it('loads platform-state.md', async () => {
    const state = await loadPlatformState();
    expect(state).toMatch(/updated: 20\d{2}-\d{2}-\d{2}/);
    expect(state).toContain('xeclone/iLaud');
    expect(state).toContain('Propreneur Bridge');
  });

  it('builds runtime context wrapper', () => {
    const ctx = buildPlatformKnowledgeContext();
    expect(ctx).toMatch(/^Platform scope/);
    expect(ctx).toContain('Platform state');
    expect(ctx).toContain('general-purpose by default');
    expect(ctx).toContain('01-devends/');
  });
});
