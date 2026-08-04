/**
 * Distill tool results into episodic text so the next turn can see evidence
 * that never made it into assistant prose (Drive reads, etc.).
 */

export type ToolWorkingSetEntry = {
  toolName?: string;
  error?: string;
  output?: string;
};

const READ_TOOL_RE =
  /^(contacts|google-contacts|google-drive-read|google-drive-search|gmail-read|gmail-search|worker-conversation-search|session-search|memory)$/i;

export function isEvidenceTool(toolName: string | undefined): boolean {
  if (!toolName) return false;
  return READ_TOOL_RE.test(toolName) || /(-read|-search|-get|-fetch)$/i.test(toolName);
}

export function toolResultSnippetLimit(toolName: string | undefined): number {
  return isEvidenceTool(toolName) ? 2_500 : 500;
}

export function buildToolWorkingSetDigest(
  entries: ToolWorkingSetEntry[],
  maxChars = 6_000,
): string {
  const useful = entries.filter((e) => {
    const body = (e.error || e.output || '').trim();
    return body.length > 0;
  });
  if (useful.length === 0) return '';

  const lines = useful.map((e, i) => {
    const name = e.toolName ?? 'tool';
    const body = (e.error ? `error: ${e.error}` : e.output ?? '').trim().replace(/\s+/g, ' ');
    const cap = isEvidenceTool(name) ? 1_200 : 400;
    return `${i + 1}. ${name}: ${body.slice(0, cap)}`;
  });

  let text =
    'Working set from this turn (tool evidence; prefer over older memory notes):\n'
    + lines.join('\n');
  if (text.length > maxChars) {
    text = `${text.slice(0, maxChars)}\n[working set truncated]`;
  }
  return text;
}

export function mergeAssistantEpisodicContent(
  turnText: string,
  digest: string,
): string {
  const prose = turnText.trim();
  const evidence = digest.trim();
  if (!prose) return evidence;
  if (!evidence) return prose;
  if (prose.includes(evidence.slice(0, Math.min(80, evidence.length)))) return prose;
  return `${prose}\n\n${evidence}`;
}
