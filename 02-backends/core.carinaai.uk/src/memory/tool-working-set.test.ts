import { describe, expect, it } from 'vitest';
import {
  buildToolWorkingSetDigest,
  isEvidenceTool,
  mergeAssistantEpisodicContent,
  toolResultSnippetLimit,
} from './tool-working-set.js';

describe('tool working set', () => {
  it('treats drive reads as evidence tools with larger snippets', () => {
    expect(isEvidenceTool('google-drive-read')).toBe(true);
    expect(toolResultSnippetLimit('google-drive-read')).toBe(2_500);
    expect(toolResultSnippetLimit('shell')).toBe(500);
  });

  it('builds a digest from tool outputs', () => {
    const digest = buildToolWorkingSetDigest([
      { toolName: 'google-drive-read', output: 'Laud Paul-Gablah CV Linux admin experience' },
      { toolName: 'shell', error: 'timeout' },
    ]);
    expect(digest).toContain('Working set from this turn');
    expect(digest).toContain('google-drive-read');
    expect(digest).toContain('Laud Paul-Gablah');
    expect(digest).toContain('error: timeout');
  });

  it('merges assistant prose with digest without duplicating', () => {
    const digest = buildToolWorkingSetDigest([
      { toolName: 'google-drive-read', output: 'CV body' },
    ]);
    const merged = mergeAssistantEpisodicContent('Here is what I found in your CVs.', digest);
    expect(merged).toContain('Here is what I found');
    expect(merged).toContain('Working set from this turn');
    expect(mergeAssistantEpisodicContent(merged, digest)).toBe(merged);
  });
});
