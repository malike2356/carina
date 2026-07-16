import { describe, expect, it } from 'vitest';
import {
  detectSafeUrls,
  exportRuntimeSummaryJson,
  exportTranscriptMarkdown,
  lastAssistantReply,
  searchTranscript,
  transcriptBlocks,
  type ReviewBlock,
} from './review-mode.js';
import type { ChatMessage } from '../ink/hooks/useMessages.js';

const messages: ChatMessage[] = [
  { id: '1', role: 'user', parts: [{ kind: 'text', content: 'Open https://carinaai.uk' }] },
  { id: '2', role: 'assistant', parts: [{ kind: 'text', content: 'Done token=secret' }] },
  { id: '3', role: 'assistant', parts: [{ kind: 'tool', toolName: 'http', args: { url: 'https://carinaai.uk' }, result: { ok: true }, isRunning: false }] },
];

describe('review mode helpers', () => {
  it('builds searchable blocks across roles and tools', () => {
    const blocks = transcriptBlocks(messages);
    expect(blocks).toHaveLength(3);
    expect(searchTranscript(blocks, 'tool')[0]?.role).toBe('tool');
  });

  it('copies the last assistant text block', () => {
    expect(lastAssistantReply(transcriptBlocks(messages))).toContain('Done');
  });

  it('exports sanitized markdown and JSON', () => {
    const blocks = transcriptBlocks(messages);
    expect(exportTranscriptMarkdown(blocks)).toContain('token=[redacted]');
    expect(exportRuntimeSummaryJson(blocks)).not.toContain('token=secret');
  });

  it('detects safe URLs only', () => {
    expect(detectSafeUrls('https://carinaai.uk http://example.com http://localhost:3000')).toEqual([
      'https://carinaai.uk',
      'http://localhost:3000',
    ]);
  });

  it('handles empty transcripts', () => {
    const empty: ReviewBlock[] = [];
    expect(lastAssistantReply(empty)).toBe('');
    expect(exportTranscriptMarkdown(empty)).toContain('No transcript data');
  });
});
