/**
 * Clean plain-text preview for document list cards.
 * Strips HTML tags and common markdown markers so cards do not show raw markup.
 */
export function documentPlainText(content: string): string {
  let text = (content ?? '').replace(/\r\n?/g, '\n');

  if (/^\s*</.test(text)) {
    text = text
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|h[1-6]|li|blockquote|tr|pre)>/gi, '\n')
      .replace(/<li[^>]*>/gi, '• ')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'");
  }

  text = text
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '• ')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/`{1,3}([^`]+)`{1,3}/g, '$1')
    .replace(/^---+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();

  return text;
}

export function documentPreview(content: string, maxChars = 160): string {
  const plain = documentPlainText(content);
  if (!plain) return 'Empty document';
  if (plain.length <= maxChars) return plain;
  return `${plain.slice(0, maxChars).replace(/\s+\S*$/, '').trim()}…`;
}

export function documentWordCount(content: string): number {
  const plain = documentPlainText(content);
  if (!plain) return 0;
  return plain.split(/\s+/).filter(Boolean).length;
}
