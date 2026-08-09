import { describe, expect, it } from 'vitest';
import { __testBuildInboundText } from './router.js';

describe('channel spreadsheet attachments', () => {
  it('preserves the filename and local path and instructs conversion', () => {
    const text = __testBuildInboundText({
      id: 'message-1',
      channel: 'telegram',
      externalUserId: 'user-1',
      conversationId: 'chat-1',
      text: 'Import these leads and return Excel',
      timestamp: new Date(),
      isDirect: true,
      isMention: false,
      isCommand: false,
      attachments: [{ filename: 'leads.xlsx', path: '/data/aiva-uploads/ws/worker/leads.xlsx' }],
    });
    expect(text).toContain('leads.xlsx -> /data/aiva-uploads/ws/worker/leads.xlsx');
    expect(text).toContain('aiva-spreadsheet-convert');
    expect(text).toContain('Import these leads');
  });
});
