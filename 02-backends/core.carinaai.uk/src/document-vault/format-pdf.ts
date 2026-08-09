/**
 * Deterministic PDF generator for vault artifacts (no browser).
 * Produces a minimal valid PDF 1.4 with Helvetica text lines.
 */

export type VaultPdfOptions = {
  title: string;
  author?: string;
  pageWidth?: number;
  pageHeight?: number;
  margin?: number;
  fontSize?: number;
};

function pdfEscape(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function wrapLines(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  for (const raw of text.replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.length ? raw : ' ';
    if (line.length <= maxChars) {
      lines.push(line);
      continue;
    }
    let rest = line;
    while (rest.length > maxChars) {
      lines.push(rest.slice(0, maxChars));
      rest = rest.slice(maxChars);
    }
    if (rest) lines.push(rest);
  }
  return lines.slice(0, 2000);
}

export function buildDeterministicPdf(
  bodyText: string,
  options: VaultPdfOptions,
): Buffer {
  const pageWidth = options.pageWidth ?? 612;
  const pageHeight = options.pageHeight ?? 792;
  const margin = options.margin ?? 54;
  const fontSize = options.fontSize ?? 11;
  const maxChars = Math.max(20, Math.floor((pageWidth - margin * 2) / (fontSize * 0.5)));
  const lines = wrapLines(bodyText, maxChars);
  const leading = fontSize + 4;
  const usableHeight = pageHeight - margin * 2;
  const linesPerPage = Math.max(1, Math.floor(usableHeight / leading));
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += linesPerPage) {
    pages.push(lines.slice(i, i + linesPerPage));
  }
  if (pages.length === 0) pages.push([' ']);

  const objects: string[] = [];
  const add = (body: string) => {
    objects.push(body);
    return objects.length;
  };

  const kids: number[] = [];
  const contentIds: number[] = [];

  for (const pageLines of pages) {
    const contentLines = [
      'BT',
      `/F1 ${fontSize} Tf`,
      `${margin} ${pageHeight - margin - fontSize} Td`,
      `${leading} TL`,
    ];
    pageLines.forEach((line, idx) => {
      if (idx === 0) contentLines.push(`(${pdfEscape(line)}) Tj`);
      else contentLines.push(`T* (${pdfEscape(line)}) Tj`);
    });
    contentLines.push('ET');
    const stream = contentLines.join('\n');
    const contentId = add(
      `<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}\nendstream`,
    );
    contentIds.push(contentId);
  }

  const fontId = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  for (let i = 0; i < pages.length; i += 1) {
    const pageId = add(
      `<< /Type /Page /Parent 0 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] `
      + `/Contents ${contentIds[i]} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> >>`,
    );
    kids.push(pageId);
  }

  const pagesId = add(
    `<< /Type /Pages /Kids [${kids.map((id) => `${id} 0 R`).join(' ')}] /Count ${kids.length} >>`,
  );

  // Patch parent refs in page objects
  for (let i = 0; i < kids.length; i += 1) {
    const idx = kids[i]! - 1;
    objects[idx] = objects[idx]!.replace('/Parent 0 0 R', `/Parent ${pagesId} 0 R`);
  }

  const title = pdfEscape(options.title.slice(0, 200));
  const author = pdfEscape((options.author ?? 'Aiva Document Vault').slice(0, 200));
  const infoId = add(`<< /Title (${title}) /Author (${author}) /Producer (document-vault-formats/1.0.0) >>`);
  const catalogId = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (let i = 0; i < objects.length; i += 1) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xrefPos = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i <= objects.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R /Info ${infoId} 0 R >>\n`;
  pdf += `startxref\n${xrefPos}\n%%EOF\n`;
  return Buffer.from(pdf, 'utf8');
}

export function htmlOrMarkdownToPlain(input: string, kind: 'html' | 'markdown' | 'plain_text'): string {
  if (kind === 'plain_text') return input;
  if (kind === 'markdown') {
    return input
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  }
  return input
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}
