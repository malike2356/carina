import { createHash } from 'node:crypto';

/** Stable content hash for conflict detection (title + body). */
export function hashDocumentContent(title: string, content: string): string {
  return createHash('sha256')
    .update(`${title.trim()}\n${content.replace(/\r\n/g, '\n').trim()}`, 'utf8')
    .digest('hex');
}
