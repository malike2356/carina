function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function inlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="md-code">$1</code>');
}

/** Render a small safe markdown subset for Aiva chat bubbles. */
export function renderWidgetMarkdown(text: string): string {
  const lines = escapeHtml(text).split('\n');
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const trimmed = lines[i]?.trim() ?? '';

    if (/^\d+\.\s/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i]?.trim() ?? '')) {
        const item = (lines[i] ?? '').trim().replace(/^\d+\.\s+/, '');
        items.push(`<li>${inlineMarkdown(item)}</li>`);
        i += 1;
      }
      out.push(`<ol class="md-list">${items.join('')}</ol>`);
      continue;
    }

    if (/^[-*]\s/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s/.test(lines[i]?.trim() ?? '')) {
        const item = (lines[i] ?? '').trim().replace(/^[-*]\s+/, '');
        items.push(`<li>${inlineMarkdown(item)}</li>`);
        i += 1;
      }
      out.push(`<ul class="md-list">${items.join('')}</ul>`);
      continue;
    }

    if (!trimmed) {
      i += 1;
      continue;
    }

    const paraLines: string[] = [];
    while (i < lines.length) {
      const line = lines[i] ?? '';
      const lineTrimmed = line.trim();
      if (!lineTrimmed) break;
      if (/^\d+\.\s/.test(lineTrimmed) || /^[-*]\s/.test(lineTrimmed)) break;
      paraLines.push(lineTrimmed);
      i += 1;
    }
    out.push(`<p>${inlineMarkdown(paraLines.join('<br>'))}</p>`);
  }

  return out.join('');
}
