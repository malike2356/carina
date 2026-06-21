import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import type { ConfirmFn } from '../agents/tool-runner.js';
import { CARINA_DATA_DIR } from '../config/paths.js';
import { expandPath, isBlockedSystemWrite, isSafePath } from './path-utils.js';
import { checkDocker, runCodeInSandbox, type SandboxResult } from './sandbox.js';

export const BRIDGE_TIMEOUT_MS = 5 * 60 * 1000;
export const MAX_BRIDGE_TOOL_CALLS = 50;
export const MAX_BRIDGE_OUTPUT_BYTES = 50 * 1024;
const BRIDGE_POLL_MS = 50;
const BRIDGE_ROOT = path.join(CARINA_DATA_DIR, 'code-exec');

export function detectLanguage(code: string): 'javascript' | 'python' {
  if (/^\s*(def |import |print\(|from )/m.test(code)) return 'python';
  return 'javascript';
}

export function truncateCodeOutput(text: string, maxBytes = MAX_BRIDGE_OUTPUT_BYTES): string {
  const bytes = Buffer.byteLength(text, 'utf8');
  if (bytes <= maxBytes) return text;
  const buf = Buffer.from(text, 'utf8').subarray(0, maxBytes);
  return `${buf.toString('utf8')}\n[truncated: output exceeded ${maxBytes} bytes]`;
}

function resolveWorkdir(raw?: string): string | undefined {
  const value = String(raw ?? process.env.CARINA_JOB_WORKDIR ?? '').trim();
  if (!value) return undefined;
  const resolved = path.resolve(expandPath(value));
  if (!isSafePath(resolved) || isBlockedSystemWrite(resolved)) {
    throw new Error(`workdir is not allowed: ${value}`);
  }
  return resolved;
}

const CARINA_TOOLS_PY = `import json
import os
import time
import uuid
import shlex

BRIDGE_DIR = '/bridge'
CALL_TIMEOUT_SEC = 120
POLL_INTERVAL_SEC = 0.05

def _call_tool(tool, params):
    call_id = str(uuid.uuid4())
    req_path = os.path.join(BRIDGE_DIR, f'{call_id}.request.json')
    resp_path = os.path.join(BRIDGE_DIR, f'{call_id}.response.json')
    with open(req_path, 'w', encoding='utf-8') as f:
        json.dump({'tool': tool, 'params': params}, f)
    deadline = time.time() + CALL_TIMEOUT_SEC
    while time.time() < deadline:
        if os.path.exists(resp_path):
            with open(resp_path, encoding='utf-8') as f:
                data = json.load(f)
            if 'error' in data:
                raise RuntimeError(str(data['error']))
            return data.get('result')
        time.sleep(POLL_INTERVAL_SEC)
    raise TimeoutError(f'Tool call {tool} timed out waiting for bridge response')

def read_file(path, **kwargs):
    return _call_tool('file-read', {'path': path, **kwargs})

def write_file(path, content, **kwargs):
    return _call_tool('file-write', {'path': path, 'content': content, **kwargs})

def search_files(**kwargs):
    return _call_tool('search-files', kwargs)

def patch(**kwargs):
    return _call_tool('patch', kwargs)

def shell_exec(command, **kwargs):
    allowed = {k: v for k, v in kwargs.items() if k in ('workdir', 'timeout')}
    return _call_tool('shell-exec', {'command': command, **allowed})

def json_parse(text):
    return json.loads(text, strict=False)

def shell_quote(s):
    return shlex.quote(str(s))

def retry(fn, max_attempts=3, delay=2):
    last_err = None
    for attempt in range(max_attempts):
        try:
            return fn()
        except Exception as err:
            last_err = err
            if attempt + 1 >= max_attempts:
                break
            time.sleep(delay * (attempt + 1))
    raise last_err
`;

const CARINA_TOOLS_JS = `const fs = require('fs');
const path = require('path');

const BRIDGE_DIR = '/bridge';
const CALL_TIMEOUT_SEC = 120;
const POLL_INTERVAL_MS = 50;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callTool(tool, params) {
  const callId = require('crypto').randomUUID();
  const reqPath = path.join(BRIDGE_DIR, callId + '.request.json');
  const respPath = path.join(BRIDGE_DIR, callId + '.response.json');
  fs.writeFileSync(reqPath, JSON.stringify({ tool, params }));
  const deadline = Date.now() + CALL_TIMEOUT_SEC * 1000;
  while (Date.now() < deadline) {
    if (fs.existsSync(respPath)) {
      const data = JSON.parse(fs.readFileSync(respPath, 'utf8'));
      if (data.error) throw new Error(String(data.error));
      return data.result;
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error('Tool call ' + tool + ' timed out waiting for bridge response');
}

async function readFile(filePath, opts = {}) {
  return callTool('file-read', { path: filePath, ...opts });
}

async function writeFile(filePath, content, opts = {}) {
  return callTool('file-write', { path: filePath, content, ...opts });
}

async function searchFiles(opts = {}) {
  return callTool('search-files', opts);
}

async function patchFile(opts = {}) {
  return callTool('patch', opts);
}

async function shellExec(command, opts = {}) {
  const allowed = {};
  if (opts.workdir !== undefined) allowed.workdir = opts.workdir;
  if (opts.timeout !== undefined) allowed.timeout = opts.timeout;
  return callTool('shell-exec', { command, ...allowed });
}

function jsonParse(text) {
  return JSON.parse(text);
}

function shellQuote(s) {
  return require('child_process').spawnSync('printf', ['%q', String(s)]).stdout.toString().trim();
}

async function retry(fn, maxAttempts = 3, delay = 2) {
  let lastErr;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt + 1 >= maxAttempts) break;
      await sleep(delay * (attempt + 1) * 1000);
    }
  }
  throw lastErr;
}

module.exports = {
  readFile,
  writeFile,
  searchFiles,
  patchFile,
  shellExec,
  jsonParse,
  shellQuote,
  retry,
  callTool,
};
`;

export interface BridgeContext {
  sessionId: string;
  confirm?: ConfirmFn;
}

export interface BridgeServicerState {
  callCount: number;
  limitExceeded: boolean;
  stopped: boolean;
}

function shellExecBridgeBlocked(params: Record<string, unknown>): string | null {
  if (params.background === true) {
    return 'background is not allowed via code-exec bridge';
  }
  if (params.pty === true) {
    return 'pty is not allowed via code-exec bridge';
  }
  return null;
}

export async function processBridgeRequest(
  bridgeDir: string,
  requestFile: string,
  ctx: BridgeContext,
  state: BridgeServicerState,
): Promise<void> {
  const callId = path.basename(requestFile, '.request.json');
  const responsePath = path.join(bridgeDir, `${callId}.response.json`);

  if (state.limitExceeded || state.callCount >= MAX_BRIDGE_TOOL_CALLS) {
    state.limitExceeded = true;
    await fs.writeFile(
      responsePath,
      JSON.stringify({ error: 'tool call limit exceeded' }),
      'utf8',
    );
    state.callCount += 1;
    return;
  }

  let request: { tool?: string; params?: Record<string, unknown> };
  try {
    const raw = await fs.readFile(requestFile, 'utf8');
    request = JSON.parse(raw) as { tool?: string; params?: Record<string, unknown> };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await fs.writeFile(responsePath, JSON.stringify({ error: msg }), 'utf8');
    state.callCount += 1;
    return;
  }

  const toolName = String(request.tool ?? '').trim();
  const params = { ...(request.params ?? {}) };

  if (!toolName) {
    await fs.writeFile(responsePath, JSON.stringify({ error: 'tool name is required' }), 'utf8');
    state.callCount += 1;
    return;
  }

  if (toolName === 'shell-exec') {
    const blocked = shellExecBridgeBlocked(params);
    if (blocked) {
      await fs.writeFile(responsePath, JSON.stringify({ error: blocked }), 'utf8');
      state.callCount += 1;
      return;
    }
  }

  let result: unknown;
  try {
    const { executeToolCall } = await import('../agents/tool-runner.js');
    result = await executeToolCall(
      {
        type: 'tool_call',
        toolName,
        toolCallId: callId,
        params,
      },
      ctx.confirm,
      false,
      ctx.sessionId,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await fs.writeFile(responsePath, JSON.stringify({ error: msg }), 'utf8');
    state.callCount += 1;
    return;
  }

  if (result !== null && typeof result === 'object' && 'error' in result) {
    await fs.writeFile(responsePath, JSON.stringify({ error: String((result as { error: unknown }).error) }), 'utf8');
  } else {
    await fs.writeFile(responsePath, JSON.stringify({ result }), 'utf8');
  }
  state.callCount += 1;
}

async function listPendingRequests(bridgeDir: string): Promise<string[]> {
  const entries = await fs.readdir(bridgeDir);
  return entries
    .filter((name) => name.endsWith('.request.json'))
    .map((name) => path.join(bridgeDir, name));
}

export function startBridgeServicer(
  bridgeDir: string,
  ctx: BridgeContext,
): { stop: () => void; done: Promise<void>; state: BridgeServicerState } {
  const state: BridgeServicerState = { callCount: 0, limitExceeded: false, stopped: false };
  const inFlight = new Set<string>();
  let timer: ReturnType<typeof setInterval> | undefined;

  const tick = async (): Promise<void> => {
    if (state.stopped) return;
    const pending = await listPendingRequests(bridgeDir);
    for (const requestFile of pending) {
      if (inFlight.has(requestFile)) continue;
      inFlight.add(requestFile);
      void processBridgeRequest(bridgeDir, requestFile, ctx, state)
        .catch(() => undefined)
        .finally(() => {
          inFlight.delete(requestFile);
        });
    }
  };

  timer = setInterval(() => {
    void tick();
  }, BRIDGE_POLL_MS);
  void tick();

  let resolveDone: () => void = () => undefined;
  const done = new Promise<void>((resolve) => {
    resolveDone = resolve;
  });

  return {
    state,
    stop: () => {
      state.stopped = true;
      if (timer) clearInterval(timer);
      resolveDone();
    },
    done,
  };
}

async function prepareBridgeDir(
  code: string,
  language: 'javascript' | 'python',
): Promise<string> {
  const bridgeDir = path.join(BRIDGE_ROOT, randomUUID());
  await fs.mkdir(bridgeDir, { recursive: true });
  if (language === 'python') {
    await fs.writeFile(path.join(bridgeDir, 'carina_tools.py'), CARINA_TOOLS_PY, 'utf8');
    await fs.writeFile(path.join(bridgeDir, 'script.py'), code, 'utf8');
  } else {
    await fs.writeFile(path.join(bridgeDir, 'carina_tools.js'), CARINA_TOOLS_JS, 'utf8');
    await fs.writeFile(path.join(bridgeDir, 'script.js'), code, 'utf8');
  }
  return bridgeDir;
}

async function cleanupBridgeDir(bridgeDir: string): Promise<void> {
  await fs.rm(bridgeDir, { recursive: true, force: true }).catch(() => undefined);
}

export interface RunCodeWithBridgeOptions {
  code: string;
  language: 'javascript' | 'python';
  sessionId?: string;
  confirm?: ConfirmFn;
  workdir?: string;
}

export async function runCodeWithBridge(
  options: RunCodeWithBridgeOptions,
): Promise<SandboxResult> {
  const dockerOk = await checkDocker();
  if (!dockerOk) {
    return {
      stdout: '',
      stderr:
        'Bridge code execution requires Docker. Install Docker or set CARINA_DIRECT_SHELL=true to run scripts directly on the host instead.',
      exitCode: 1,
    };
  }

  const bridgeDir = await prepareBridgeDir(options.code, options.language);
  const ctx: BridgeContext = {
    sessionId: options.sessionId ?? 'default-session',
    confirm: options.confirm,
  };
  const servicer = startBridgeServicer(bridgeDir, ctx);
  const workdir = resolveWorkdir(options.workdir);

  try {
    return await runCodeInSandbox(options.code, options.language, {
      timeout: BRIDGE_TIMEOUT_MS,
      memoryMb: 128,
      networkDisabled: true,
      workdir,
      bridgeDir,
    });
  } finally {
    servicer.stop();
    await servicer.done;
    await cleanupBridgeDir(bridgeDir);
  }
}
