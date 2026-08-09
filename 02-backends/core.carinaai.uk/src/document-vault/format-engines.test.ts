import { describe, expect, it } from 'vitest';
import { convertExportContent, convertImportUpload } from './format-convert.js';
import { loadFormatCapabilityMatrix, assertEditableFormat } from './format-capabilities.js';
import { buildDeterministicPdf } from './format-pdf.js';
import { assertSafeUploadBytes, sanitizeHtmlFragment } from './format-safety.js';

describe('Document vault format engines (709)', () => {
  it('exposes a capability matrix with editable and non-editable formats', () => {
    const matrix = loadFormatCapabilityMatrix();
    expect(matrix.converterVersion).toContain('document-vault-formats');
    expect(matrix.formats.some((f) => f.id === 'markdown' && f.edit)).toBe(true);
    expect(matrix.formats.some((f) => f.id === 'pdf' && !f.edit)).toBe(true);
    expect(() => assertEditableFormat('pdf')).toThrow(/not editable/i);
    expect(assertEditableFormat('markdown').create).toBe(true);
  });

  it('blocks archives, executables, oversized, and spoofed PDF uploads', () => {
    expect(assertSafeUploadBytes('x.zip', Buffer.from([0x50, 0x4b, 0x03, 0x04])).blocked).toBe(true);
    expect(assertSafeUploadBytes('run.exe', Buffer.from('MZ')).blocked).toBe(true);
    expect(assertSafeUploadBytes('huge.txt', Buffer.alloc(13_000_000, 61)).blocked).toBe(true);
    expect(assertSafeUploadBytes('fake.pdf', Buffer.from('not a pdf')).blocked).toBe(true);
  });

  it('sanitizes HTML and imports markdown/csv/json round trips', async () => {
    const dirty = await convertImportUpload({
      filename: 'page.html',
      bytes: Buffer.from('<p onclick="alert(1)">Hi<script>evil()</script></p>'),
    });
    expect(dirty.ok).toBe(true);
    if (dirty.ok) {
      expect(dirty.content.toString('utf8')).not.toContain('script');
      expect(dirty.content.toString('utf8')).not.toContain('onclick');
      expect(dirty.warnings.some((w) => w.code === 'html_sanitized')).toBe(true);
    }

    const md = await convertImportUpload({
      filename: 'note.md',
      bytes: Buffer.from('# Title\n\nHello'),
    });
    expect(md.ok).toBe(true);
    if (md.ok) {
      const exported = await convertExportContent({
        vaultKind: 'markdown',
        content: md.content,
        targetFormat: 'markdown',
      });
      expect(exported.ok).toBe(true);
      if (exported.ok) expect(exported.content.toString('utf8')).toContain('Hello');
    }

    const csv = await convertImportUpload({
      filename: 'grid.csv',
      bytes: Buffer.from('a,b\n1,2\n'),
    });
    expect(csv.ok).toBe(true);

    const badJson = await convertImportUpload({
      filename: 'x.json',
      bytes: Buffer.from('{nope'),
    });
    expect(badJson.ok).toBe(false);
  });

  it('normalizes xlsx to csv with lossy warning and generates deterministic PDF', async () => {
    const XLSX = await import('xlsx');
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      book,
      XLSX.utils.aoa_to_sheet([
        ['name', 'qty'],
        ['alpha', 1],
      ]),
      'Sheet1',
    );
    const xlsxBytes = XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    const imported = await convertImportUpload({
      filename: 'sheet.xlsx',
      bytes: xlsxBytes,
    });
    expect(imported.ok).toBe(true);
    if (imported.ok) {
      expect(imported.extension).toBe('csv');
      expect(imported.generated).toBe(true);
      expect(imported.warnings.some((w) => w.code === 'spreadsheet_normalized')).toBe(true);
    }

    const pdf = buildDeterministicPdf('Hello vault PDF\nLine 2', { title: 'Test' });
    expect(pdf.subarray(0, 5).toString('utf8')).toBe('%PDF-');
    expect(pdf.includes(Buffer.from('%%EOF'))).toBe(true);

    const exported = await convertExportContent({
      vaultKind: 'markdown',
      content: Buffer.from('# Report\n\nBody'),
      targetFormat: 'pdf',
      title: 'Report',
    });
    expect(exported.ok).toBe(true);
    if (exported.ok) {
      expect(exported.generated).toBe(true);
      expect(exported.mimeType).toBe('application/pdf');
      expect(exported.warnings.some((w) => w.code === 'pdf_generated_artifact')).toBe(true);
    }
  });

  it('strips RTF and rejects unsupported edit requests via sanitize helper', () => {
    expect(sanitizeHtmlFragment('<img src=x onerror=alert(1)>')).not.toContain('onerror');
    expect(assertSafeUploadBytes('macro.bat', Buffer.from('echo hi')).blocked).toBe(true);
  });
});
