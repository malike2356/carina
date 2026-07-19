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
    list: () => ['anthropic', 'deepseek'],
    current: () => ({ name: 'deepseek' }),
  },
}));

const executeToolCallMock = vi.fn();

vi.mock('./tool-runner.js', () => ({
  executeToolCall: (...args: unknown[]) => executeToolCallMock(...args),
}));

vi.mock('../tools/web-search-provider.js', () => ({
  runWebSearch: vi.fn(async () => {
    throw new Error('use tool mock');
  }),
  resolveSearchProvider: vi.fn(() => 'tavily'),
  searchProviderLabel: vi.fn(() => 'Tavily'),
}));

describe('deep-research planning', () => {
  beforeEach(() => {
    chatMock.mockReset();
    executeToolCallMock.mockReset();
    process.env.CARINA_TEACHER_ESCALATION = 'false';
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
        '4. What are the rates?',
        '5. What are the caveats?',
      ].join('\n'),
    });
    chatMock.mockResolvedValueOnce({
      content: JSON.stringify({
        keep: [{ id: 'src-1', note: 'ok' }, { id: 'src-2', note: 'ok' }, { id: 'src-3', note: 'ok' }],
      }),
    });
    chatMock.mockResolvedValue({
      content: JSON.stringify({
        title: 'UK Stamp Duty 2026',
        summary: 'Executive summary covering rates, who pays, and key caveats for the 2026 stamp duty landscape in the UK.',
        sections: [
          { heading: 'Overview', body: `${'Body with cited evidence [src-1]. '.repeat(40)}`, sourceCitations: ['src-1'] },
          { heading: 'Changes', body: `${'More body with evidence [src-2]. '.repeat(40)}`, sourceCitations: ['src-2'] },
          { heading: 'Impact', body: `${'Impact body with evidence [src-3]. '.repeat(40)}`, sourceCitations: ['src-3'] },
        ],
      }),
    });

    executeToolCallMock.mockImplementation(async (call: { toolName: string; params?: Record<string, unknown> }) => {
      if (call.toolName === 'web-search') {
        const q = String(call.params?.query ?? 'q').slice(0, 12);
        return [
          { title: `HMRC ${q}`, url: `https://example.com/stamp-${encodeURIComponent(q)}`, description: 'Rates overview' },
          { title: `Gov ${q}`, url: `https://example.com/gov-${encodeURIComponent(q)}`, description: 'Policy update' },
          { title: `BBC ${q}`, url: `https://example.com/bbc-${encodeURIComponent(q)}`, description: 'News report' },
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
      maxQualityPasses: 0,
      persist: false,
      onProgress: (line) => progress.push(line),
    });

    expect(report.sections.length).toBeGreaterThanOrEqual(3);
    expect(report.summary.length).toBeGreaterThan(0);
    expect(report.sources.length).toBeGreaterThanOrEqual(3);
    expect(progress.some((p) => p.includes('Planning'))).toBe(true);
    expect(progress.some((p) => p.includes('Synthesising'))).toBe(true);
  });
});

describe('deep-research synthesis and limits', () => {
  beforeEach(() => {
    chatMock.mockReset();
    executeToolCallMock.mockReset();
    process.env.CARINA_TEACHER_ESCALATION = 'false';
  });

  it('synthesis produces a report with all required fields', async () => {
    chatMock.mockResolvedValueOnce({
      content: '1. Question A?\n2. Question B?\n3. Question C?',
    });
    chatMock.mockResolvedValueOnce({
      content: JSON.stringify({
        keep: [{ id: 'src-1', note: 'ok' }, { id: 'src-2', note: 'ok' }],
      }),
    });
    chatMock.mockResolvedValueOnce({
      content: JSON.stringify({
        title: 'Test Report',
        summary: 'Executive summary covering the core findings, caveats, and what the evidence supports for this research topic.',
        sections: [
          { heading: 'One', body: `${'Detailed findings with citations [src-1]. '.repeat(20)}`, sourceCitations: ['src-1'] },
          { heading: 'Two', body: `${'Additional analysis with evidence [src-2]. '.repeat(20)}`, sourceCitations: ['src-2'] },
          { heading: 'Three', body: `${'Implications and open questions [src-1]. '.repeat(20)}`, sourceCitations: ['src-1'] },
        ],
      }),
    });

    executeToolCallMock.mockImplementation(async (call: { toolName: string }) => {
      if (call.toolName === 'web-search') {
        return [
          { title: 'A', url: 'https://example.com/a', description: 'a' },
          { title: 'B', url: 'https://example.com/b', description: 'b' },
          { title: 'C', url: 'https://example.com/c', description: 'c' },
        ];
      }
      if (call.toolName === 'http-request') {
        return { status: 200, body: `<p>${'content '.repeat(30)}</p>` };
      }
      return { error: 'unknown' };
    });

    const report = await runDeepResearch({
      query: 'test topic',
      maxRounds: 2,
      maxSources: 5,
      maxQualityPasses: 0,
      persist: false,
    });

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
        keep: [{ id: 'src-1', note: 'ok' }, { id: 'src-2', note: 'ok' }],
      }),
    });
    chatMock.mockResolvedValueOnce({
      content: JSON.stringify({
        title: 'Cap Test',
        summary: 'Executive summary for the source-cap regression covering what was found and what remains uncertain.',
        sections: [
          { heading: 'A', body: `${'Section A with cited evidence [src-1]. '.repeat(25)}`, sourceCitations: ['src-1'] },
          { heading: 'B', body: `${'Section B with cited evidence [src-2]. '.repeat(25)}`, sourceCitations: ['src-2'] },
          { heading: 'C', body: `${'Section C with cited evidence [src-1]. '.repeat(25)}`, sourceCitations: ['src-1'] },
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
      return { status: 200, body: `<p>${'Stamp duty content for extraction. '.repeat(20)}</p>` };
    });

    const report = await runDeepResearch({
      query: 'cap test',
      maxRounds: 3,
      maxSources: 4,
      maxQualityPasses: 0,
      persist: false,
    });

    expect(report.sources.length).toBeLessThanOrEqual(4);
  });

  it('saveToFile writes valid markdown', async () => {
    chatMock.mockResolvedValueOnce({ content: '1. Q1?\n2. Q2?\n3. Q3?' });
    chatMock.mockResolvedValueOnce({
      content: JSON.stringify({
        keep: [{ id: 'src-1', note: 'ok' }, { id: 'src-2', note: 'ok' }],
      }),
    });
    chatMock.mockResolvedValueOnce({
      content: JSON.stringify({
        title: 'Saved Report',
        summary: 'Saved executive summary with enough detail to pass the research quality gate for this topic.',
        sections: [
          { heading: 'H1', body: `${'Body with citations [src-1]. '.repeat(25)}`, sourceCitations: ['src-1'] },
          { heading: 'H2', body: `${'Body two with citations [src-2]. '.repeat(25)}`, sourceCitations: ['src-2'] },
          { heading: 'H3', body: `${'Body three with citations [src-1]. '.repeat(25)}`, sourceCitations: ['src-1'] },
        ],
      }),
    });
    executeToolCallMock.mockImplementation(async (call: { toolName: string }) => {
      if (call.toolName === 'web-search') {
        return [
          { title: 'A', url: 'https://example.com/a', description: 'a' },
          { title: 'B', url: 'https://example.com/b', description: 'b' },
        ];
      }
      return { status: 200, body: `<p>${'content '.repeat(40)}</p>` };
    });

    const target = path.join('/tmp', `carina-deep-research-${Date.now()}.md`);
    const report = await runDeepResearch({
      query: 'save test',
      maxRounds: 2,
      maxSources: 4,
      maxQualityPasses: 0,
      saveToFile: target,
      persist: false,
    });

    const written = await fs.readFile(target, 'utf8');
    expect(written).toContain('# Saved Report');
    expect(written).toContain('## Executive Summary');
    expect(renderReportMarkdown(report)).toContain('Saved executive summary');
    await fs.unlink(target);
  });

  it('fails when web search returns no sources', async () => {
    chatMock.mockResolvedValueOnce({ content: '1. Q1?\n2. Q2?\n3. Q3?' });
    executeToolCallMock.mockResolvedValue([]);

    await expect(runDeepResearch({
      query: 'empty search',
      maxRounds: 2,
      maxQualityPasses: 0,
      persist: false,
    })).rejects.toThrow(/no web sources/i);
  });

  it('returns partial research when synthesis is useful but below the depth gate', async () => {
    chatMock.mockResolvedValueOnce({ content: '1. Q1?\n2. Q2?\n3. Q3?\n4. Q4?\n5. Q5?' });
    chatMock.mockResolvedValueOnce({
      content: JSON.stringify({
        keep: [{ id: 'src-1', note: 'ok' }, { id: 'src-2', note: 'ok' }],
      }),
    });
    chatMock.mockResolvedValue({
      content: JSON.stringify({
        title: 'Partial AI Adoption Report',
        summary: 'Summary unavailable.',
        sections: [
          {
            heading: 'Findings',
            body: 'Available evidence shows business AI adoption is increasing, but long-range agent counts remain forecast-based [src-1].',
            sourceCitations: ['src-1'],
          },
        ],
      }),
    });
    executeToolCallMock.mockImplementation(async (call: { toolName: string }) => {
      if (call.toolName === 'web-search') {
        return [
          { title: 'AI adoption forecast', url: 'https://example.com/ai-adoption', description: 'Business adoption evidence and forecasts' },
          { title: 'Agent market report', url: 'https://example.com/agent-market', description: 'AI agent market analysis' },
        ];
      }
      return { status: 200, body: `<p>${'AI adoption evidence and forecast caveats. '.repeat(20)}</p>` };
    });

    const report = await runDeepResearch({
      query: 'how many ai agents will exist by 2035',
      maxRounds: 9,
      maxSources: 4,
      maxQualityPasses: 0,
      persist: false,
    });

    expect(report.summary).toContain('Partial research report');
    expect(report.sections.some((section) => section.heading === 'Quality note')).toBe(true);
    expect(report.sections.some((section) => section.heading === 'Source-backed evidence gathered')).toBe(true);
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
        keep: [
          { id: 'src-1', note: 'primary source' },
          { id: 'src-2', note: 'supporting source' },
        ],
      }),
    });
    chatMock.mockResolvedValueOnce({
      content: JSON.stringify({
        title: 'Verified Report',
        summary: 'Verified executive summary describing the retained sources and the main conclusions for this topic.',
        sections: [
          { heading: 'A', body: `${'Section A with evidence [src-1]. '.repeat(25)}`, sourceCitations: ['src-1'] },
          { heading: 'B', body: `${'Section B with evidence [src-2]. '.repeat(25)}`, sourceCitations: ['src-2'] },
          { heading: 'C', body: `${'Section C with evidence [src-1]. '.repeat(25)}`, sourceCitations: ['src-1'] },
        ],
      }),
    });

    executeToolCallMock.mockImplementation(async (call: { toolName: string; params: Record<string, unknown> }) => {
      if (call.toolName === 'web-search') {
        return [
          { title: 'Good', url: 'https://example.com/good', description: 'good' },
          { title: 'Also', url: 'https://example.com/also', description: 'also' },
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
      maxQualityPasses: 0,
      persist: false,
      onProgress: (line) => progress.push(line),
    });

    expect(progress.some((p) => p.includes('Verifying'))).toBe(true);
    expect(report.sources.length).toBe(2);
    expect(report.sources.every((s) => s.url.includes('weak') === false)).toBe(true);
  });
});

describe('/research gateway command', () => {
  beforeEach(() => {
    chatMock.mockReset();
    executeToolCallMock.mockReset();
    process.env.CARINA_TEACHER_ESCALATION = 'false';
  });

  it('returns a non-empty summary', async () => {
    chatMock.mockResolvedValueOnce({ content: '1. Q1?\n2. Q2?\n3. Q3?\n4. Q4?\n5. Q5?' });
    chatMock.mockResolvedValueOnce({
      content: JSON.stringify({
        keep: [{ id: 'src-1', note: 'ok' }, { id: 'src-2', note: 'ok' }],
      }),
    });
    chatMock.mockResolvedValue({
      content: JSON.stringify({
        title: 'Gateway Report',
        summary: 'Gateway summary text with enough length for quality checks across the requested research topic.',
        sections: [
          { heading: 'A', body: `${'Section A with enough content for quality gate. '.repeat(30)}`, sourceCitations: ['src-1'] },
          { heading: 'B', body: `${'Section B with enough content for quality gate. '.repeat(30)}`, sourceCitations: ['src-2'] },
          { heading: 'C', body: `${'Section C with enough content for quality gate. '.repeat(30)}`, sourceCitations: ['src-1'] },
        ],
      }),
    });
    executeToolCallMock.mockImplementation(async (call: { toolName: string; params?: Record<string, unknown> }) => {
      if (call.toolName === 'web-search') {
        const q = String(call.params?.query ?? 'q').slice(0, 10);
        return [
          { title: 'Source A', url: `https://example.com/source-a-${encodeURIComponent(q)}`, description: 'snippet a' },
          { title: 'Source B', url: `https://example.com/source-b-${encodeURIComponent(q)}`, description: 'snippet b' },
        ];
      }
      return { status: 200, body: `<p>${'gateway content '.repeat(30)}</p>` };
    });

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
