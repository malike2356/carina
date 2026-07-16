const ANSI_PATTERN = /\x1b\[[0-9;?]*[A-Za-z]/g;
const ASCII_PRINTABLE_PATTERN = /^[\x20-\x7e]*$/;

export interface TranscriptLine {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  text: string;
}

export interface RenderedTranscript {
  lines: string[];
  totalLines: number;
  truncated: boolean;
}

export interface ToolOutputFold {
  lines: string[];
  folded: boolean;
  hiddenLineCount: number;
}

export function stripAnsi(text: string): string {
  return text.replace(ANSI_PATTERN, '');
}

export function cellWidth(text: string): number {
  if (ASCII_PRINTABLE_PATTERN.test(text)) return text.length;
  let width = 0;
  for (const char of stripAnsi(text)) {
    const code = char.codePointAt(0) ?? 0;
    if (code === 0) continue;
    if (code < 32 || (code >= 0x7f && code < 0xa0)) continue;
    width += isWideCodePoint(code) ? 2 : 1;
  }
  return width;
}

export function truncateCells(text: string, maxWidth: number, marker = '...'): string {
  if (maxWidth <= 0) return '';
  if (cellWidth(text) <= maxWidth) return text;
  const markerWidth = cellWidth(marker);
  if (maxWidth <= markerWidth) return marker.slice(0, maxWidth);
  let out = '';
  let width = 0;
  for (const char of stripAnsi(text)) {
    const nextWidth = isWideCodePoint(char.codePointAt(0) ?? 0) ? 2 : 1;
    if (width + nextWidth + markerWidth > maxWidth) break;
    out += char;
    width += nextWidth;
  }
  return `${out}${marker}`;
}

export function wrapCells(text: string, width: number): string[] {
  if (width <= 0) return [''];
  const words = stripAnsi(text).split(/(\s+)/).filter((part) => part.length > 0);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const next = current ? `${current}${word}` : word.trimStart();
    if (cellWidth(next) <= width) {
      current = next;
      continue;
    }
    if (current.trim()) lines.push(current.trimEnd());
    current = cellWidth(word) > width ? truncateCells(word.trim(), width) : word.trimStart();
  }

  if (current.trim()) lines.push(current.trimEnd());
  return lines.length > 0 ? lines : [''];
}

export function mergeMarkdownChunks(chunks: string[]): string {
  return chunks.join('').replace(/\r\n/g, '\n');
}

export function renderCodeBlock(code: string, width: number): string[] {
  return code.split('\n').flatMap((line) => wrapCells(line, width));
}

export function foldToolOutput(output: string, maxLines = 6, expanded = false): ToolOutputFold {
  const lines = output.split('\n');
  if (expanded || lines.length <= maxLines) {
    return { lines, folded: false, hiddenLineCount: 0 };
  }
  const visible = lines.slice(0, Math.max(1, maxLines - 1));
  const hiddenLineCount = lines.length - visible.length;
  return {
    lines: [...visible, `[${hiddenLineCount} lines folded]`],
    folded: true,
    hiddenLineCount,
  };
}

export function sliceViewport(lines: string[], height: number, offset = 0): string[] {
  const start = Math.max(0, Math.min(offset, Math.max(0, lines.length - height)));
  return lines.slice(start, start + Math.max(0, height));
}

export function reflowTranscript(lines: TranscriptLine[], width: number): string[] {
  return lines.flatMap((line) => {
    const prefix = `${line.role}> `;
    const available = Math.max(8, width - cellWidth(prefix));
    return wrapCells(line.text, available).map((wrapped, index) => {
      const linePrefix = index === 0 ? prefix : ' '.repeat(cellWidth(prefix));
      return truncateCells(`${linePrefix}${wrapped}`, width);
    });
  });
}

export function renderBoundedTranscript(
  transcript: TranscriptLine[],
  width: number,
  height: number,
  maxRenderedLines = 400,
): RenderedTranscript {
  const reflowed = reflowTranscript(transcript, width);
  const bounded = reflowed.slice(Math.max(0, reflowed.length - maxRenderedLines));
  return {
    lines: sliceViewport(bounded, height, Math.max(0, bounded.length - height)),
    totalLines: reflowed.length,
    truncated: reflowed.length > bounded.length,
  };
}

function isWideCodePoint(code: number): boolean {
  return (
    code >= 0x1100 && (
      code <= 0x115f
      || code === 0x2329
      || code === 0x232a
      || (code >= 0x2e80 && code <= 0xa4cf)
      || (code >= 0xac00 && code <= 0xd7a3)
      || (code >= 0xf900 && code <= 0xfaff)
      || (code >= 0xfe10 && code <= 0xfe19)
      || (code >= 0xfe30 && code <= 0xfe6f)
      || (code >= 0xff00 && code <= 0xff60)
      || (code >= 0xffe0 && code <= 0xffe6)
    )
  );
}
