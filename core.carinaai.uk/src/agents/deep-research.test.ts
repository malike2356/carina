import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  linkInlineCitations,
  parseSubQuestions,
  renderReportMarkdown,
  runDeepResearch,
} from './deep-research.js';
import { handleGatewayCommandAsync } from '../gateway/commands.js';

const chatMock = vi.fn();

vi.mock('../brain/llm.js', () => ({
  llm: {
    chat: (...args: unknown[]) => chatMock(...args),
  },
}));

const executeToolCallMock = vi.fn();

vi.mock('./tool-runner.js', () => ({
  executeToolCall: (...args: unknown[]) => executeToolCallMock(...args),
}));

describe('deep-research planning', () => {
  beforeEach(() => {
    chatMock.mockReset();
    executeToolCallMock.mockReset();
  });

  it('parseSubQuestions returns at least 3 sub-questions from numbered list', () => {
    const text = [
      '1. What changed in UK stamp duty in 2026?',
      '2. Who is affected by the new rates?',
      '3. What are the effective dates?',
      '4. How do regional rates differ?',
    ].join('\n');
    expect(parseSubQuestions(text).length).toBeGreaterThanOrEqual(3);
  });

  it('planning round returns at least 3 sub-questions', async () => {
    chatMock.mockResolvedValueOnce({
      content: [
        '1. What is stamp duty?',
        '2. What changed in 2026?',
        '3. Who pays it?',
      ].join('\n'),
    });
    chatMock.mockResolvedValueOnce({
      content: JSON.stringify({
        keep: [{ id: 'src-1', note: 'ok' }, { id: 'src-2', note: 'ok' }, { id: 'src-3', note: 'ok' }],
      }),
    });
    chatMock.mockResolvedValueOnce({
      content: JSON.stringify({
        title: 'UK Stamp Duty 2026',
        summary: 'Executive summary here.',
        sections: [
          { heading: 'Overview', body: 'Body [src-1]', sourceCitations: ['src-1'] },
          { heading: 'Changes', body: 'More body [src-2]', sourceCitations: ['src-2'] },
          { heading: 'Impact', body: 'Impact body [src-3]', sourceCitations: ['src-3'] },
        ],
      }),
    });

    executeToolCallMock.mockImplementation(async (call: { toolName: string }) => {
      if (call.toolName === 'web-search') {
        return [
          { title: 'HMRC Stamp Duty', url: 'https://example.com/stamp', description: 'Rates overview' },
          { title: 'Gov UK', url: 'https://example.com/gov', description: 'Policy update' },
          { title: 'BBC News', url: 'https://example.com/bbc', description: 'News report' },
        ];
      }
      if (call.toolName === 'http-request') {
        return {
          status: 200,
          body: `<html><body><p>${'Stamp duty rates updated in 2026. '.repeat(12)}</p></body></html>`,
        };
      }
      return { error: 'unknown' };
    });

    const progress: string[] = [];
    const report = await runDeepResearch({
      query: 'UK stamp duty changes 2026',
      maxRounds: 3,
      maxSources: 6,
      persist: false,
      onProgress: (line) => progress.push(line),
    });

    expect(report.sections.length).toBeGreaterThanOrEqual(3);
    expect(report.summary.length).toBeGreaterThan(0);
    expect(report.sources.length).toBeGreaterThanOrEqual(3);
    expect(progress.some((p) => p.startsWith('Planning'))).toBe(true);
    expect(progress.some((p) => p.startsWith('Synthesising'))).toBe(true);
  });
});

describe('deep-research synthesis and limits', () => {
  beforeEach(() => {
    chatMock.mockReset();
    executeToolCallMock.mockReset();
  });

  it('synthesis produces a report with all required fields', async () => {
    chatMock.mockResolvedValueOnce({
      content: '1. Question A?\n2. Question B?\n3. Question C?',
    });
    chatMock.mockResolvedValueOnce({
      content: JSON.stringify({
        title: 'Test Report',
        summary: 'Short summary.',
        sections: [
          { heading: 'One', body: 'A', sourceCitations: ['src-1'] },
          { heading: 'Two', body: 'B', sourceCitations: ['src-2'] },
          { heading: 'Three', body: 'C', sourceCitations: ['src-3'] },
        ],
      }),
    });

    executeToolCallMock.mockResolvedValue([
      { title: 'A', url: 'https://example.com/a', description: 'a' },
    ]);

    const report = await runDeepResearch({ query: 'test topic', maxRounds: 2, maxSources: 5, persist: false });

    expect(report.title).toBeTruthy();
    expect(report.summary).toBeTruthy();
    expect(report.sections.length).toBeGreaterThanOrEqual(3);
    expect(report.generatedAt).toBeTruthy();
    expect(report.searchQueries.length).toBeGreaterThan(0);
  });

  it('maxSources cap is respected', async () => {
    chatMock.mockResolvedValueOnce({ content: '1. Q1?\n2. Q2?\n3. Q3?' });
    chatMock.mockResolvedValueOnce({
      content: JSON.stringify({
        title: 'Cap Test',
        summary: 'Summary.',
        sections: [
          { heading: 'A', body: 'a', sourceCitations: [] },
          { heading: 'B', body: 'b', sourceCitations: [] },
          { heading: 'C', body: 'c', sourceCitations: [] },
        ],
      }),
    });

    executeToolCallMock.mockImplementation(async (call: { toolName: string; params: Record<string, unknown> }) => {
      if (call.toolName === 'web-search') {
        return Array.from({ length: 5 }, (_, i) => ({
          title: `Hit ${i}`,
          url: `https://example.com/${call.params.query}/${i}`,
          description: 'desc',
        }));
      }
      return { status: 200, body: 'content' };
    });

    const report = await runDeepResearch({
      query: 'cap test',
      maxRounds: 4,
      maxSources: 4,
      persist: false,
    });

    expect(report.sources.length).toBeLessThanOrEqual(4);
  });

  it('saveToFile writes valid markdown', async () => {
    chatMock.mockResolvedValueOnce({ content: '1. Q1?\n2. Q2?\n3. Q3?' });
    chatMock.mockResolvedValueOnce({
      content: JSON.stringify({
        title: 'Saved Report',
        summary: 'Saved summary.',
        sections: [
          { heading: 'H1', body: 'Body', sourceCitations: ['src-1'] },
          { heading: 'H2', body: 'Body 2', sourceCitations: [] },
          { heading: 'H3', body: 'Body 3', sourceCitations: [] },
        ],
      }),
    });
    executeToolCallMock.mockResolvedValue([]);

    const target = path.join('/tmp', `carina-deep-research-${Date.now()}.md`);
    const report = await runDeepResearch({
      query: 'save test',
      maxRounds: 2,
      saveToFile: target,
      persist: false,
    });

    const written = await fs.readFile(target, 'utf8');
    expect(written).toContain('# Saved Report');
    expect(written).toContain('## Executive Summary');
    expect(renderReportMarkdown(report)).toContain('Saved summary.');
    await fs.unlink(target);
  });

  it('renders inline citations and provenance', () => {
    const md = renderReportMarkdown({
      title: 'Cite Test',
      summary: 'Summary.',
      sections: [{ heading: 'H', body: 'Fact [src-1]', sourceCitations: ['src-1'] }],
      sources: [{
        id: 'src-1',
        title: 'Example',
        url: 'https://example.com',
        snippet: 'snippet text',
        fetchedAt: '2026-01-01T00:00:00Z',
        verified: true,
        verifyNote: 'relevant',
      }],
      searchQueries: [],
      roundCount: 2,
      generatedAt: '2026-01-01T00:00:00Z',
    });
    expect(md).toContain('## Source Provenance');
    expect(md).toContain('[src-1](https://example.com');
    expect(linkInlineCitations('See [src-1]', [{
      id: 'src-1',
      title: 'Example',
      url: 'https://example.com',
      snippet: 'x',
      fetchedAt: '2026-01-01T00:00:00Z',
    }])).toContain('https://example.com');
  });

  it('runs verify step and filters weak sources', async () => {
    chatMock.mockResolvedValueOnce({ content: '1. Q1?\n2. Q2?\n3. Q3?' });
    chatMock.mockResolvedValueOnce({
      content: JSON.stringify({
        keep: [{ id: 'src-1', note: 'primary source' }],
      }),
    });
    chatMock.mockResolvedValueOnce({
      content: JSON.stringify({
        title: 'Verified Report',
        summary: 'Verified summary.',
        sections: [
          { heading: 'A', body: 'a [src-1]', sourceCitations: ['src-1'] },
          { heading: 'B', body: 'b', sourceCitations: [] },
          { heading: 'C', body: 'c', sourceCitations: [] },
        ],
      }),
    });

    executeToolCallMock.mockImplementation(async (call: { toolName: string; params: Record<string, unknown> }) => {
      if (call.toolName === 'web-search') {
        return [
          { title: 'Good', url: 'https://example.com/good', description: 'good' },
          { title: 'Weak', url: 'https://example.com/weak', description: 'weak' },
        ];
      }
      if (call.toolName === 'http-request') {
        const url = String(call.params.url ?? '');
        if (url.includes('weak')) return { status: 200, body: 'short' };
        return { status: 200, body: 'x'.repeat(200) };
      }
      return { error: 'unknown' };
    });

    const progress: string[] = [];
    const report = await runDeepResearch({
      query: 'verify test',
      maxRounds: 2,
      maxSources: 4,
      persist: false,
      onProgress: (line) => progress.push(line),
    });

    expect(progress.some((p) => p.startsWith('Verifying'))).toBe(true);
    expect(report.sources.length).toBeLessThanOrEqual(2);
  });
});

describe('/research gateway command', () => {
  beforeEach(() => {
    chatMock.mockReset();
    executeToolCallMock.mockReset();
  });

  it('returns a non-empty summary', async () => {
    chatMock.mockResolvedValueOnce({ content: '1. Q1?\n2. Q2?\n3. Q3?' });
    chatMock.mockResolvedValueOnce({
      content: JSON.stringify({
        title: 'Gateway Report',
        summary: 'Gateway summary text.',
        sections: [
          { heading: 'A', body: 'a', sourceCitations: [] },
          { heading: 'B', body: 'b', sourceCitations: [] },
          { heading: 'C', body: 'c', sourceCitations: [] },
        ],
      }),
    });
    executeToolCallMock.mockResolvedValue([
      { title: 'Source', url: 'https://example.com/source', description: 'snippet' },
    ]);

    const result = await handleGatewayCommandAsync('/research UK tax changes', {
      sessionId: 'test-session',
      channel: 'telegram',
    });

    expect(result.handled).toBe(true);
    if (!result.handled) return;
    expect(result.reply.length).toBeGreaterThan(0);
    expect(result.reply).toContain('Gateway summary');
  });
});
