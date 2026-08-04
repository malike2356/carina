import { describe, expect, it } from 'vitest';
import { extractGmailAttachments } from './email-attachments';

describe('extractGmailAttachments', () => {
  it('collects named parts with Gmail attachment ids', () => {
    const msg = {
      payload: {
        mimeType: 'multipart/mixed',
        parts: [
          { mimeType: 'text/plain', body: { data: 'SGVsbG8=' } },
          {
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            filename: 'VERLOX-Business-Plan.docx',
            body: { attachmentId: 'ATT1', size: 1200 },
          },
          {
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            filename: 'VERLOX-Financials.xlsx',
            body: { attachmentId: 'ATT2', size: 3400 },
          },
        ],
      },
    };

    expect(extractGmailAttachments(msg)).toEqual([
      {
        id: 'ATT1',
        filename: 'VERLOX-Business-Plan.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        size: 1200,
      },
      {
        id: 'ATT2',
        filename: 'VERLOX-Financials.xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        size: 3400,
      },
    ]);
  });

  it('ignores multipart wrappers and body text', () => {
    const msg = {
      payload: {
        mimeType: 'multipart/alternative',
        parts: [
          { mimeType: 'text/plain', body: { data: 'YQ==' } },
          { mimeType: 'text/html', body: { data: 'YQ==' } },
        ],
      },
    };
    expect(extractGmailAttachments(msg)).toEqual([]);
  });
});
