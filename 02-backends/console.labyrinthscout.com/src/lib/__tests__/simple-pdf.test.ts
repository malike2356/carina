import { describe, expect, it } from 'vitest';
import { buildSimplePdf, buildTextPagePdf } from '../simple-pdf.js';

describe('buildSimplePdf', () => {
  it('produces a valid PDF with a computed startxref offset', () => {
    const pdf = buildSimplePdf([
      { id: 1, body: '<< /Type /Catalog /Pages 2 0 R >>' },
      { id: 2, body: '<< /Type /Pages /Kids [3 0 R] /Count 1 >>' },
      { id: 3, body: '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>' },
      { id: 4, body: '<< /Length 11 >>\nstream\nHello World\nendstream' },
    ]);

    const text = pdf.toString('ascii');
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text.endsWith('%%EOF\n') || text.endsWith('%%EOF')).toBe(true);

    const startxrefMatch = text.match(/startxref\n(\d+)/);
    expect(startxrefMatch).not.toBeNull();
    const offset = Number(startxrefMatch?.[1]);
    expect(text.slice(offset, offset + 4)).toBe('xref');
  });

  it('buildTextPagePdf includes report lines', () => {
    const pdf = buildTextPagePdf(['line one', 'line two']);
    const text = pdf.toString('ascii');
    expect(text).toContain('line one');
    expect(text).toContain('startxref');
  });
});
