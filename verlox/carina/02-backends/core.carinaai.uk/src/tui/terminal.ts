export interface TerminalSize {
  cols: number;
  rows: number;
}

export function getTerminalSize(): TerminalSize {
  const cols = process.stdout.columns ?? 80;
  const rows = process.stdout.rows ?? 24;
  return { cols: Math.max(40, cols), rows: Math.max(12, rows) };
}

export function truncate(text: string, width: number): string {
  if (width <= 0) return '';
  if (text.length <= width) return text;
  if (width <= 1) return text.slice(0, width);
  return `${text.slice(0, width - 1)}…`;
}

export function padLine(text: string, width: number): string {
  if (text.length >= width) return truncate(text, width);
  return text + ' '.repeat(width - text.length);
}

export function wrapText(text: string, width: number): string[] {
  if (width < 8) return [truncate(text, width)];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > width) {
      if (current) lines.push(current);
      current = word.length > width ? truncate(word, width) : word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [''];
}

export { cellWidth, truncateCells, wrapCells } from './renderer/primitives.js';

export function drawBox(title: string, lines: string[], width: number, height: number, focused = false): string[] {
  const innerW = Math.max(0, width - 2);
  const innerH = Math.max(0, height - 2);
  const border = focused ? '─' : '·';
  const top = `┌${title ? ` ${truncate(title, innerW - 2)} ` : ''}${border.repeat(Math.max(0, innerW - title.length - (title ? 2 : 0)))}┐`;
  const out: string[] = [truncate(top, width)];
  for (let i = 0; i < innerH; i++) {
    const content = padLine(truncate(lines[i] ?? '', innerW), innerW);
    out.push(`│${content}│`);
  }
  const bottom = `└${'─'.repeat(innerW)}┘`;
  out.push(truncate(bottom, width));
  return out;
}

export const ALT_SCREEN_ON = '\x1b[?1049h\x1b[?25l';
export const ALT_SCREEN_OFF = '\x1b[?1049l\x1b[?25h';
export const CLEAR_SCREEN = '\x1b[2J\x1b[H';
export const SHOW_CURSOR = '\x1b[?25h';
export const HIDE_CURSOR = '\x1b[?25l';
