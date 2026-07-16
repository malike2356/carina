import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import { v4 as uuidv4 } from 'uuid';

export interface LspLocation {
  uri: string;
  range: { start: { line: number; character: number }; end: { line: number; character: number } };
}

export interface LspDiagnostic {
  message: string;
  severity?: number;
  range?: LspLocation['range'];
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
}

const servers = new Map<string, {
  proc: ChildProcessWithoutNullStreams;
  pending: Map<number, PendingRequest>;
  buffer: string;
  rootUri: string;
}>();

function encodeMessage(payload: string): Buffer {
  const body = Buffer.from(payload, 'utf8');
  return Buffer.from(`Content-Length: ${body.length}\r\n\r\n${payload}`, 'utf8');
}

function parseMessages(buffer: string): { messages: string[]; rest: string } {
  const messages: string[] = [];
  let rest = buffer;
  while (true) {
    const headerEnd = rest.indexOf('\r\n\r\n');
    if (headerEnd === -1) break;
    const header = rest.slice(0, headerEnd);
    const match = header.match(/Content-Length:\s*(\d+)/i);
    if (!match) break;
    const length = Number(match[1]);
    const start = headerEnd + 4;
    if (rest.length < start + length) break;
    messages.push(rest.slice(start, start + length));
    rest = rest.slice(start + length);
  }
  return { messages, rest };
}

export async function startLspServer(
  sessionKey: string,
  command: string,
  args: string[],
  rootPath: string,
): Promise<void> {
  if (servers.has(sessionKey)) return;

  const proc = spawn(command, args, { cwd: rootPath, stdio: 'pipe' });
  const state = {
    proc,
    pending: new Map<number, PendingRequest>(),
    buffer: '',
    rootUri: `file://${rootPath}`,
  };
  servers.set(sessionKey, state);

  proc.stdout.on('data', (chunk: Buffer) => {
    state.buffer += chunk.toString('utf8');
    const parsed = parseMessages(state.buffer);
    state.buffer = parsed.rest;
    for (const raw of parsed.messages) {
      try {
        const msg = JSON.parse(raw) as { id?: number; result?: unknown; error?: { message: string } };
        if (msg.id == null) continue;
        const pending = state.pending.get(msg.id);
        if (!pending) continue;
        state.pending.delete(msg.id);
        if (msg.error) pending.reject(new Error(msg.error.message));
        else pending.resolve(msg.result);
      } catch {
        // ignore malformed
      }
    }
  });

  proc.stderr.on('data', () => undefined);
  proc.on('exit', () => servers.delete(sessionKey));

  await lspRequest(sessionKey, 'initialize', {
    processId: process.pid,
    rootUri: state.rootUri,
    capabilities: {},
  });
  proc.stdin.write(encodeMessage(JSON.stringify({ jsonrpc: '2.0', method: 'initialized', params: {} })));
}

function lspRequest(sessionKey: string, method: string, params: unknown): Promise<unknown> {
  const state = servers.get(sessionKey);
  if (!state) return Promise.reject(new Error('LSP server not started'));

  const id = state.pending.size + 1;
  return new Promise((resolve, reject) => {
    state.pending.set(id, { resolve, reject });
    const payload = JSON.stringify({ jsonrpc: '2.0', id, method, params });
    state.proc.stdin.write(encodeMessage(payload));
    setTimeout(() => {
      if (state.pending.has(id)) {
        state.pending.delete(id);
        reject(new Error(`LSP request timed out: ${method}`));
      }
    }, 15_000);
  });
}

const LANGUAGE_SPECS: Record<string, { command: string; args: string[] }> = {
  typescript: { command: 'typescript-language-server', args: ['--stdio'] },
  javascript: { command: 'typescript-language-server', args: ['--stdio'] },
  python: { command: 'pylsp', args: [] },
  rust: { command: 'rust-analyzer', args: [] },
  go: { command: 'gopls', args: ['serve'] },
};

function inferLanguage(method: string, params: unknown): string {
  if (method === 'textDocument/didOpen' && params && typeof params === 'object') {
    const doc = (params as { textDocument?: { languageId?: string } }).textDocument;
    if (doc?.languageId) return doc.languageId;
  }
  return 'typescript';
}

export async function executeLspRequest(
  sessionKey: string,
  method: string,
  params: unknown,
  options?: { language?: string; rootPath?: string },
): Promise<unknown> {
  if (method === 'shutdown' || method === 'exit') {
    stopLspServer(sessionKey);
    return null;
  }

  if (method === 'initialize') {
    return { capabilities: {} };
  }

  const language = options?.language ?? inferLanguage(method, params);
  if (!servers.has(sessionKey)) {
    const spec = LANGUAGE_SPECS[language] ?? LANGUAGE_SPECS.typescript;
    const rootPath = options?.rootPath ?? process.cwd();
    await startLspServer(sessionKey, spec.command, spec.args, rootPath);
  }

  return lspRequest(sessionKey, method, params);
}

export async function lspDefinition(
  sessionKey: string,
  filePath: string,
  line: number,
  character: number,
): Promise<unknown> {
  return lspRequest(sessionKey, 'textDocument/definition', {
    textDocument: { uri: `file://${filePath}` },
    position: { line, character },
  });
}

export async function lspReferences(
  sessionKey: string,
  filePath: string,
  line: number,
  character: number,
): Promise<unknown> {
  return lspRequest(sessionKey, 'textDocument/references', {
    textDocument: { uri: `file://${filePath}` },
    position: { line, character },
    context: { includeDeclaration: true },
  });
}

export async function lspHover(
  sessionKey: string,
  filePath: string,
  line: number,
  character: number,
): Promise<unknown> {
  return lspRequest(sessionKey, 'textDocument/hover', {
    textDocument: { uri: `file://${filePath}` },
    position: { line, character },
  });
}

export async function lspDiagnostics(sessionKey: string, filePath: string): Promise<LspDiagnostic[]> {
  const result = await lspRequest(sessionKey, 'textDocument/diagnostic', {
    textDocument: { uri: `file://${filePath}` },
  }) as { items?: LspDiagnostic[] } | LspDiagnostic[] | null;
  if (Array.isArray(result)) return result;
  return result?.items ?? [];
}

export function stopLspServer(sessionKey: string): void {
  const state = servers.get(sessionKey);
  if (!state) return;
  state.proc.kill();
  servers.delete(sessionKey);
}

export function defaultLspSessionKey(sessionId: string): string {
  return `lsp:${sessionId || uuidv4()}`;
}
