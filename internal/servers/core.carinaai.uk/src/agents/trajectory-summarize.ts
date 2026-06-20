function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}...[${text.length - max} more chars]`;
}

function tailLines(text: string, lines = 8, maxChars = 1200): string {
  const parts = text.split('\n').filter((l) => l.trim().length > 0);
  const tail = parts.slice(-lines).join('\n');
  return clip(tail, maxChars);
}

function summarizeShell(result: Record<string, unknown>): string {
  const exit = result.exit_code ?? result.exitCode ?? result.code ?? '?';
  const stdout = String(result.stdout ?? result.output ?? '').trim();
  const stderr = String(result.stderr ?? '').trim();
  const chunks = [`exit=${exit}`];
  if (stdout) chunks.push(`stdout tail:\n${tailLines(stdout)}`);
  if (stderr) chunks.push(`stderr tail:\n${tailLines(stderr, 4, 400)}`);
  return chunks.join('\n');
}

function summarizeFileRead(result: Record<string, unknown>, params?: Record<string, unknown>): string {
  const path = String(params?.path ?? result.path ?? 'file');
  const content = String(result.content ?? result.data ?? '');
  const lines = content ? content.split('\n').length : 0;
  const preview = content ? tailLines(content, 5, 500) : '(empty)';
  return `read ${path} (${lines} lines)\n${preview}`;
}

function summarizeFileWrite(result: Record<string, unknown>, params?: Record<string, unknown>): string {
  const path = String(params?.path ?? result.path ?? 'file');
  if (result.error) return `write ${path} failed: ${String(result.error)}`;
  return `write ${path} ok`;
}

function summarizeWebSearch(result: Record<string, unknown>): string {
  const results = Array.isArray(result.results) ? result.results : [];
  if (results.length === 0) return 'web-search: no results';
  const lines = results.slice(0, 5).map((item, idx) => {
    const row = asRecord(item);
    const title = String(row?.title ?? row?.name ?? `result ${idx + 1}`);
    const url = String(row?.url ?? row?.link ?? '');
    return url ? `- ${title} (${url})` : `- ${title}`;
  });
  return `web-search (${results.length} hits):\n${lines.join('\n')}`;
}

function summarizeHttp(result: Record<string, unknown>): string {
  const status = result.status ?? result.statusCode ?? '?';
  const body = String(result.body ?? result.data ?? result.text ?? '').trim();
  return `http status=${status}\n${body ? tailLines(body, 6, 800) : '(no body)'}`;
}

function summarizeBrowser(result: Record<string, unknown>, toolName: string): string {
  const url = String(result.url ?? result.pageUrl ?? '');
  const title = String(result.title ?? '');
  const snapshot = String(result.snapshot ?? result.text ?? result.content ?? '').trim();
  const header = [toolName, title, url].filter(Boolean).join(' | ');
  if (!snapshot) return header || `${toolName} ok`;
  return `${header}\n${tailLines(snapshot, 10, 1000)}`;
}

function summarizeGeneric(result: unknown, toolName: string, maxChars: number): string {
  if (typeof result === 'string') return clip(result, maxChars);
  const record = asRecord(result);
  if (!record) return clip(JSON.stringify(result), maxChars);

  if (record.error) {
    return `${toolName} error: ${clip(String(record.error), Math.min(maxChars, 300))}`;
  }

  const keys = Object.keys(record);
  const compact: Record<string, unknown> = {};
  for (const key of keys.slice(0, 12)) {
    const val = record[key];
    if (typeof val === 'string') compact[key] = clip(val, 160);
    else if (Array.isArray(val)) compact[key] = `[${val.length} items]`;
    else if (val && typeof val === 'object') compact[key] = '{...}';
    else compact[key] = val;
  }
  if (keys.length > 12) compact._moreKeys = keys.length - 12;
  return clip(JSON.stringify(compact), maxChars);
}

export function summarizeToolResult(
  toolName: string,
  result: unknown,
  params?: Record<string, unknown>,
  maxChars = 600,
): string {
  const record = asRecord(result);
  let summary = '';

  if (toolName === 'shell-exec' || toolName === 'process') {
    summary = record ? summarizeShell(record) : summarizeGeneric(result, toolName, maxChars);
  } else if (toolName === 'file-read' || toolName === 'search-files') {
    summary = record ? summarizeFileRead(record, params) : summarizeGeneric(result, toolName, maxChars);
  } else if (toolName === 'file-write' || toolName === 'patch') {
    summary = record ? summarizeFileWrite(record, params) : summarizeGeneric(result, toolName, maxChars);
  } else if (toolName === 'web-search') {
    summary = record ? summarizeWebSearch(record) : summarizeGeneric(result, toolName, maxChars);
  } else if (toolName === 'http-request') {
    summary = record ? summarizeHttp(record) : summarizeGeneric(result, toolName, maxChars);
  } else if (toolName.startsWith('browser-')) {
    summary = record ? summarizeBrowser(record, toolName) : summarizeGeneric(result, toolName, maxChars);
  } else {
    summary = summarizeGeneric(result, toolName, maxChars);
  }

  return clip(summary, maxChars);
}
