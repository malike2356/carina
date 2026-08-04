import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type IBorderOptions,
} from 'docx';

const THIN_BORDER: IBorderOptions = {
  style: BorderStyle.SINGLE,
  size: 4,
  color: 'CCCCCC',
};

function textRunsFromNode(
  node: Node,
  marks: { bold?: boolean; italics?: boolean; underline?: boolean } = {},
): TextRun[] {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? '';
    if (!text) return [];
    return [
      new TextRun({
        text,
        bold: marks.bold,
        italics: marks.italics,
        underline: marks.underline ? {} : undefined,
      }),
    ];
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return [];
  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();
  const nextMarks = {
    bold: marks.bold || tag === 'strong' || tag === 'b',
    italics: marks.italics || tag === 'em' || tag === 'i',
    underline: marks.underline || tag === 'u',
  };

  if (tag === 'br') {
    return [new TextRun({ break: 1 })];
  }

  const runs: TextRun[] = [];
  for (const child of Array.from(el.childNodes)) {
    runs.push(...textRunsFromNode(child, nextMarks));
  }
  return runs;
}

function paragraphFromElement(el: HTMLElement): Paragraph {
  const tag = el.tagName.toLowerCase();
  const runs = textRunsFromNode(el);
  const align =
    el.style.textAlign === 'center'
      ? AlignmentType.CENTER
      : el.style.textAlign === 'right'
        ? AlignmentType.RIGHT
        : el.style.textAlign === 'justify'
          ? AlignmentType.BOTH
          : AlignmentType.LEFT;

  if (tag === 'h1') {
    return new Paragraph({ children: runs, heading: HeadingLevel.HEADING_1, alignment: align });
  }
  if (tag === 'h2') {
    return new Paragraph({ children: runs, heading: HeadingLevel.HEADING_2, alignment: align });
  }
  if (tag === 'h3') {
    return new Paragraph({ children: runs, heading: HeadingLevel.HEADING_3, alignment: align });
  }
  if (tag === 'blockquote') {
    return new Paragraph({
      children: runs.length ? runs : [new TextRun('')],
      indent: { left: 420 },
      alignment: align,
    });
  }
  return new Paragraph({
    children: runs.length ? runs : [new TextRun('')],
    alignment: align,
    spacing: { after: 120 },
  });
}

function tableFromElement(tableEl: HTMLTableElement): Table {
  const rows: TableRow[] = [];
  for (const tr of Array.from(tableEl.querySelectorAll('tr'))) {
    const cells = Array.from(tr.children).filter((c) => {
      const tag = c.tagName.toLowerCase();
      return tag === 'td' || tag === 'th';
    }) as HTMLElement[];
    if (!cells.length) continue;
    rows.push(
      new TableRow({
        children: cells.map(
          (cell) =>
            new TableCell({
              borders: {
                top: THIN_BORDER,
                bottom: THIN_BORDER,
                left: THIN_BORDER,
                right: THIN_BORDER,
              },
              width: { size: Math.floor(9000 / Math.max(cells.length, 1)), type: WidthType.DXA },
              children: [paragraphFromElement(cell)],
            }),
        ),
      }),
    );
  }
  return new Table({
    width: { size: 9000, type: WidthType.DXA },
    rows: rows.length
      ? rows
      : [
          new TableRow({
            children: [
              new TableCell({
                children: [new Paragraph('')],
              }),
            ],
          }),
        ],
  });
}

function blocksFromHtml(html: string): Array<Paragraph | Table> {
  if (typeof DOMParser === 'undefined') {
    return [new Paragraph({ children: [new TextRun(html.replace(/<[^>]+>/g, ' '))] })];
  }
  const doc = new DOMParser().parseFromString(`<div id="root">${html}</div>`, 'text/html');
  const root = doc.getElementById('root') ?? doc.body;
  const blocks: Array<Paragraph | Table> = [];

  for (const child of Array.from(root.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = (child.textContent ?? '').trim();
      if (text) blocks.push(new Paragraph({ children: [new TextRun(text)] }));
      continue;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue;
    const el = child as HTMLElement;
    const tag = el.tagName.toLowerCase();
    if (tag === 'table') {
      blocks.push(tableFromElement(el as HTMLTableElement));
      continue;
    }
    if (tag === 'ul' || tag === 'ol') {
      const ordered = tag === 'ol';
      Array.from(el.children).forEach((li, index) => {
        if (li.tagName.toLowerCase() !== 'li') return;
        const runs = textRunsFromNode(li);
        blocks.push(
          new Paragraph({
            children: [
              new TextRun(ordered ? `${index + 1}. ` : '• '),
              ...(runs.length ? runs : [new TextRun('')]),
            ],
            spacing: { after: 80 },
          }),
        );
      });
      continue;
    }
    if (tag === 'hr') {
      blocks.push(new Paragraph({ children: [new TextRun('────────────────────────────────')] }));
      continue;
    }
    if (tag === 'img') {
      const alt = el.getAttribute('alt') || 'Image';
      blocks.push(new Paragraph({ children: [new TextRun(`[Image: ${alt}]`)] }));
      continue;
    }
    blocks.push(paragraphFromElement(el));
  }

  if (!blocks.length) {
    blocks.push(new Paragraph({ children: [new TextRun('')] }));
  }
  return blocks;
}

export async function htmlToDocxBlob(html: string, title: string): Promise<Blob> {
  const children = blocksFromHtml(html);
  const document = new Document({
    creator: 'Aiva',
    title: title || 'Document',
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });
  return Packer.toBlob(document);
}

export async function docxArrayBufferToHtml(buffer: ArrayBuffer): Promise<string> {
  const mammoth = await import('mammoth');
  const result = await mammoth.convertToHtml(
    { arrayBuffer: buffer },
    {
      convertImage: mammoth.images.dataUri,
    },
  );
  return result.value || '<p></p>';
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.onload = () => {
      const result = String(reader.result ?? '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(blob);
  });
}

export function safeDownloadBasename(title: string, ext: string): string {
  const base = title.replace(/[^\w\-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase();
  return `${base || 'document'}.${ext}`;
}
