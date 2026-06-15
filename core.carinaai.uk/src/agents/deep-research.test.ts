import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
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
        return { status: 200, body: '<html><body><p>Stamp duty rates updated in 2026.</p></body></html>' };
      }
      return { error: 'unknown' };
    });

    const progress: string[] = [];
    const report = await runDeepResearch({
      query: 'UK stamp duty changes 2026',
      maxRounds: 3,
      maxSources: 6,
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

    const report = await runDeepResearch({ query: 'test topic', maxRounds: 2, maxSources: 5 });

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
    });

    const written = await fs.readFile(target, 'utf8');
    expect(written).toContain('# Saved Report');
    expect(written).toContain('## Executive Summary');
    expect(renderReportMarkdown(report)).toContain('Saved summary.');
    await fs.unlink(target);
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
