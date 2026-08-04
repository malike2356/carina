import { describe, expect, it } from 'vitest';
import { buildOutboundRawMime } from '@/lib/email-mime';

describe('buildOutboundRawMime', () => {
  it('builds plain text MIME without attachments', () => {
    const raw = buildOutboundRawMime({
      to: 'a@b.com',
      subject: 'Hello',
      text: 'Body line',
    });
    expect(raw).toContain('To: a@b.com');
    expect(raw).toContain('Subject: Hello');
    expect(raw).toContain('Content-Type: text/plain');
    expect(raw).toContain('Body line');
    expect(raw).not.toContain('multipart/mixed');
  });

  it('builds multipart MIME with a docx attachment', () => {
    const raw = buildOutboundRawMime({
      to: 'frank@example.com',
      subject: 'DBA pack',
      text: 'Attached.',
      attachments: [
        {
          filename: 'summary.docx',
          mimeType:
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          contentBase64: Buffer.from('fake-docx').toString('base64'),
        },
      ],
    });
    expect(raw).toContain('multipart/mixed');
    expect(raw).toContain('Content-Disposition: attachment; filename="summary.docx"');
    expect(raw).toContain('Attached.');
  });
});
