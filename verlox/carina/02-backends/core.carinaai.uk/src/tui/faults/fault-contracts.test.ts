import { describe, expect, it } from 'vitest';
import { formatUnavailableCommand, sanitizeCommandError } from '../commands/registry.js';
import { renderBoundedTranscript, type TranscriptLine } from '../renderer/primitives.js';
import { normalizeRuntimeEvent } from '../runtime-events/timeline-store.js';
import { buildSessionMap, renderSessionMap } from '../sessions/session-map.js';
import { foldToolOutput } from '../renderer/primitives.js';

describe('TUI fault contracts', () => {
  it('keeps backend command failures short and sanitized', () => {
    const message = sanitizeCommandError(new Error('boom token=abc sk_test_123456789\nstack'));
    expect(message).toBe('boom token=[redacted] [secret]');
  });

  it('returns calm unavailable slash command copy', () => {
    expect(formatUnavailableCommand('/unknown')).toContain('unavailable');
  });

  it('normalizes malformed runtime event details', () => {
    const event = normalizeRuntimeEvent({ type: 'runtime.error', detail: 'bad token=abc' });
    expect(event.detail).toBe('bad token=[redacted]');
  });

  it('folds huge tool output', () => {
    const output = Array.from({ length: 1000 }, (_, index) => `line ${index}`).join('\n');
    expect(foldToolOutput(output, 6).hiddenLineCount).toBeGreaterThan(900);
  });

  it('survives terminal resize loops and long sessions', () => {
    const transcript = Array.from({ length: 1500 }, (_, index): TranscriptLine => ({
      id: String(index),
      role: index % 2 === 0 ? 'user' : 'assistant',
      text: `Message ${index} with enough content to render safely.`,
    }));
    for (const width of [40, 60, 90, 132, 80, 50]) {
      const rendered = renderBoundedTranscript(transcript, width, 20, 100);
      expect(rendered.lines.length).toBeLessThanOrEqual(20);
    }
  });

  it('renders empty sessions without throwing', () => {
    expect(renderSessionMap(buildSessionMap([]), 80)).toEqual([]);
  });
});
