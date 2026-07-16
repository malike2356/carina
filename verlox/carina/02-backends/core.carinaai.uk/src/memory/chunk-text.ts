export const CHARS_PER_CHUNK = 2000;

export function chunkMarkdown(content: string): string[] {
  const sections = content.split(/(?=^#{1,3} )/m).filter((s) => s.trim());
  const chunks: string[] = [];
  let buffer = '';

  for (const section of sections) {
    if ((buffer + section).length > CHARS_PER_CHUNK && buffer) {
      chunks.push(buffer.trim());
      buffer = section;
    } else {
      buffer += (buffer ? '\n' : '') + section;
    }
  }

  if (buffer.trim()) chunks.push(buffer.trim());

  if (chunks.length === 0 && content.trim()) {
    const paragraphs = content.split(/\n\n+/);
    buffer = '';
    for (const para of paragraphs) {
      if ((buffer + para).length > CHARS_PER_CHUNK && buffer) {
        chunks.push(buffer.trim());
        buffer = para;
      } else {
        buffer += (buffer ? '\n\n' : '') + para;
      }
    }
    if (buffer.trim()) chunks.push(buffer.trim());
  }

  return chunks;
}

export function chunkPlainText(content: string): string[] {
  const paragraphs = content.split(/\n\n+/);
  const chunks: string[] = [];
  let buffer = '';

  for (const para of paragraphs) {
    if ((buffer + para).length > CHARS_PER_CHUNK && buffer) {
      chunks.push(buffer.trim());
      buffer = para;
    } else {
      buffer += (buffer ? '\n\n' : '') + para;
    }
  }

  if (buffer.trim()) chunks.push(buffer.trim());
  return chunks;
}

export function chunkAuto(content: string, mimeHint?: string): string[] {
  const looksMarkdown =
    (mimeHint !== undefined && mimeHint.includes('markdown')) ||
    /^#{1,3} /m.test(content);
  return looksMarkdown ? chunkMarkdown(content) : chunkPlainText(content);
}
