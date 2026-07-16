import { describe, expect, it } from 'vitest';

// Test pure helpers only; avoid loading generateSpeech (Edge CLI) in unit tests.
const SUMMARY_TTS_MAX_CHARS = 1500;

function cleanForSpeech(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function truncateSummaryForTts(text: string): string {
  const cleaned = cleanForSpeech(text);
  if (cleaned.length <= SUMMARY_TTS_MAX_CHARS) {
    return cleaned;
  }
  const truncated = cleaned.slice(0, SUMMARY_TTS_MAX_CHARS);
  const lastSpace = truncated.lastIndexOf(' ');
  const base = lastSpace > 400 ? truncated.slice(0, lastSpace) : truncated;
  return `${base}. End of summary.`;
}

describe('summary-tts', () => {
  it('truncateSummaryForTts keeps short text unchanged', () => {
    const text = 'Quiet day. No new emails.';
    expect(truncateSummaryForTts(text)).toBe(text);
  });

  it('truncateSummaryForTts caps long summaries', () => {
    const long = 'word '.repeat(800);
    const out = truncateSummaryForTts(long);
    expect(out.length).toBeLessThanOrEqual(SUMMARY_TTS_MAX_CHARS + 20);
    expect(out).toContain('End of summary.');
  });
});
