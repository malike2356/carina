export function insertMarkdownAtEnd(current: string, insertion: string): string {
  const trimmed = insertion.trim();
  if (!trimmed) return current;

  if (!current.trim()) return trimmed;

  const suffix = current.endsWith('\n') ? '\n' : '\n\n';
  return `${current}${suffix}${trimmed}`;
}

export function prefixInsertedBlock(before: string, insertion: string): string {
  const trimmed = insertion.trim();
  if (!trimmed) return '';

  if (!before.length) return trimmed;
  if (before.endsWith('\n\n')) return trimmed;
  if (before.endsWith('\n')) return `\n${trimmed}`;
  if (before.endsWith(' ')) return `\n${trimmed}`;
  return `\n\n${trimmed}`;
}
