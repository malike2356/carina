import { describe, expect, it } from 'vitest';
import {
  emailBodyForDisplay,
  emailPreviewLine,
  looksLikeHtml,
  sanitizeEmailAddress,
  stripHtmlToText,
} from './email-text';

describe('email-text', () => {
  it('detects html payloads', () => {
    expect(looksLikeHtml('<!doctype html><html><body>Hi</body></html>')).toBe(true);
    expect(looksLikeHtml('Hi Laud,<br />Please login')).toBe(true);
    expect(looksLikeHtml('Plain reply about property')).toBe(false);
  });

  it('strips tags into readable text', () => {
    const out = stripHtmlToText('<p>Hi Laud,</p><br /><p>Please <b>login</b>.</p>');
    expect(out).toContain('Hi Laud');
    expect(out).toContain('Please');
    expect(out).toContain('login');
    expect(out).not.toContain('<');
  });

  it('drops style and script blocks from html previews', () => {
    const out = emailBodyForDisplay(
      '<div dir="ltr">Hello</div><style>table, td, div { color: #333; }</style><script>alert(1)</script>',
    );
    expect(out).toBe('Hello');
    expect(out).not.toContain('color: #333');
    expect(out).not.toContain('alert(1)');
  });

  it('removes tracking urls and invisible chars', () => {
    const raw =
      'Hi Laud,\u200B watch live https://em.property-filter.co.uk/e3t/Ctc/ZV+113/d2ZXx204/VVyBnT4HqCCZW5t7K6k11p5mqW67tPB75S1z_4N6B8Nrj3prCCW7Y8-PT6lZ3q0W9bbMh15MXyJvMd9Mdc6DsMfW4R-YsG2CZJNYW9g6dcK1DzVTRW2m-8Bz1jPCT2W57h-Q722vWKYW1cxpf26g87j5 Join now';
    const out = emailBodyForDisplay(raw);
    expect(out).toContain('Hi Laud');
    expect(out).toContain('Join now');
    expect(out).not.toContain('em.property-filter.co.uk');
    expect(out).toContain('[link]');
  });

  it('drops legacy To: preview prefix', () => {
    expect(emailPreviewLine('To: lordsesame@gmail.com\n\nHello there')).toBe('Hello there');
  });

  it('rejects html-looking addresses', () => {
    expect(sanitizeEmailAddress('<table cellpadding="0">')).toBeNull();
    expect(sanitizeEmailAddress('Laud <lordsesame@gmail.com>')).toContain('@');
  });
});
