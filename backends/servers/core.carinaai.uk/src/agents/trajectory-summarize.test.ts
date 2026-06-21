import { describe, expect, it } from 'vitest';
import { summarizeToolResult } from './trajectory-summarize.js';

describe('summarizeToolResult', () => {
  it('summarizes web-search hits', () => {
    const summary = summarizeToolResult('web-search', {
      results: [
        { title: 'Carina docs', url: 'https://docs.carinaai.uk' },
        { title: 'Skills Hub', url: 'https://skills.carinaai.uk' },
      ],
    });
    expect(summary).toContain('Carina docs');
    expect(summary).toContain('2 hits');
  });

  it('summarizes file-write success', () => {
    const summary = summarizeToolResult('file-write', { ok: true }, { path: '/tmp/out.txt' });
    expect(summary).toContain('/tmp/out.txt');
    expect(summary).toContain('ok');
  });

  it('summarizes http responses', () => {
    const summary = summarizeToolResult('http-request', {
      status: 200,
      body: 'hello world',
    });
    expect(summary).toContain('status=200');
    expect(summary).toContain('hello world');
  });
});
