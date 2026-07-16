import { performance } from 'node:perf_hooks';
import { describe, expect, it } from 'vitest';
import {
  cellWidth,
  foldToolOutput,
  mergeMarkdownChunks,
  renderBoundedTranscript,
  renderCodeBlock,
  sliceViewport,
  truncateCells,
  wrapCells,
  type TranscriptLine,
} from './primitives.js';

describe('TUI renderer primitives', () => {
  it('measures ANSI and wide characters by terminal cell width', () => {
    expect(cellWidth('\x1b[31mred\x1b[0m')).toBe(3);
    expect(cellWidth('界')).toBe(2);
  });

  it('truncates and wraps by cells', () => {
    expect(cellWidth(truncateCells('abcdef', 5))).toBeLessThanOrEqual(5);
    expect(wrapCells('one two three four', 9)).toEqual(['one two', 'three', 'four']);
  });

  it('merges streaming markdown chunks deterministically', () => {
    expect(mergeMarkdownChunks(['```ts\ncon', 'sole.log(1)\n', '```'])).toBe('```ts\nconsole.log(1)\n```');
  });

  it('renders code blocks without exceeding width', () => {
    const lines = renderCodeBlock('const message = "hello from Carina";', 16);
    expect(lines.every((line) => cellWidth(line) <= 16)).toBe(true);
  });

  it('folds tool output until expanded', () => {
    const folded = foldToolOutput(['a', 'b', 'c', 'd'].join('\n'), 3);
    expect(folded.folded).toBe(true);
    expect(folded.hiddenLineCount).toBe(2);
    expect(foldToolOutput('a\nb', 3).folded).toBe(false);
  });

  it('slices viewports without dropping source lines', () => {
    expect(sliceViewport(['a', 'b', 'c', 'd'], 2, 1)).toEqual(['b', 'c']);
  });

  it('reflows transcripts across narrow, normal, and wide terminals', () => {
    const transcript: TranscriptLine[] = [
      { id: '1', role: 'user', text: 'Build a safe workflow for inbound client emails' },
      { id: '2', role: 'assistant', text: 'Missing protection layer detected. Proposed Channel Shield policy.' },
    ];
    for (const width of [40, 90, 132]) {
      const rendered = renderBoundedTranscript(transcript, width, 8);
      expect(rendered.lines.length).toBeGreaterThan(0);
      expect(rendered.lines.every((line) => cellWidth(line) <= width)).toBe(true);
    }
  });

  it('keeps large transcript rendering within a practical budget', () => {
    const transcript = Array.from({ length: 1000 }, (_, index): TranscriptLine => ({
      id: String(index),
      role: index % 2 === 0 ? 'user' : 'assistant',
      text: `Line ${index} with enough content to wrap through the renderer contract.`,
    }));
    const started = performance.now();
    const rendered = renderBoundedTranscript(transcript, 100, 24, 120);
    const elapsed = performance.now() - started;

    expect(rendered.lines).toHaveLength(24);
    expect(rendered.truncated).toBe(true);
    const budgetMs = process.env.CARINA_COVERAGE_RUN === 'true' ? 250 : 50;
    expect(elapsed).toBeLessThan(budgetMs);
  });
});
