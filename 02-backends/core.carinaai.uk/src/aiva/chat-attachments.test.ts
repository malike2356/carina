import { describe, expect, it } from 'vitest';
import {
  buildAttachmentPromptBlock,
  chatAttachmentMaxMb,
  isAllowedChatAttachmentFilename,
} from './chat-attachments.js';
import { AIVA_CHAT_ATTACHMENT_MAX_BYTES } from './chat-attachment-limits.js';

describe('chat-attachments', () => {
  it('allows spreadsheet, SPSS, PDF, and image filenames', () => {
    expect(isAllowedChatAttachmentFilename('survey.sav')).toBe(true);
    expect(isAllowedChatAttachmentFilename('data.CSV')).toBe(true);
    expect(isAllowedChatAttachmentFilename('leads.xlsx')).toBe(true);
    expect(isAllowedChatAttachmentFilename('notes.pdf')).toBe(true);
    expect(isAllowedChatAttachmentFilename('shot.PNG')).toBe(true);
    expect(isAllowedChatAttachmentFilename('evil.exe')).toBe(false);
  });

  it('raises the upload ceiling to at least 100MB', () => {
    expect(AIVA_CHAT_ATTACHMENT_MAX_BYTES).toBeGreaterThanOrEqual(100 * 1024 * 1024);
    expect(chatAttachmentMaxMb()).toBeGreaterThanOrEqual(100);
  });

  it('builds an analysis/import prompt with local paths', () => {
    const block = buildAttachmentPromptBlock([
      { absolutePath: '/data/aiva-uploads/ws/w/file.sav', filename: 'file.sav' },
    ]);
    expect(block).toContain('file.sav');
    expect(block).toContain('/data/aiva-uploads/ws/w/file.sav');
    expect(block).toContain('sav_read');
    expect(block).toContain('outreach-leads-import');
  });
});
