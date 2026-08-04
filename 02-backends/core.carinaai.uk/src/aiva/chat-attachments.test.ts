import { describe, expect, it } from 'vitest';
import { buildAttachmentPromptBlock, isAllowedChatAttachmentFilename } from './chat-attachments.js';

describe('chat-attachments', () => {
  it('allows SPSS and CSV filenames', () => {
    expect(isAllowedChatAttachmentFilename('survey.sav')).toBe(true);
    expect(isAllowedChatAttachmentFilename('data.CSV')).toBe(true);
    expect(isAllowedChatAttachmentFilename('notes.pdf')).toBe(false);
  });

  it('builds an analysis prompt with local paths', () => {
    const block = buildAttachmentPromptBlock([
      { absolutePath: '/data/aiva-uploads/ws/w/file.sav', filename: 'file.sav' },
    ]);
    expect(block).toContain('file.sav');
    expect(block).toContain('/data/aiva-uploads/ws/w/file.sav');
    expect(block).toContain('sav_read');
  });
});
