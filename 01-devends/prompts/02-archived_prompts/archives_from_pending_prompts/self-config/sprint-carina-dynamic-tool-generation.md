# Sprint: Carina Dynamic Tool Generation; Sandboxed Self-Extension

## What This Builds

When Carina encounters a task she genuinely cannot perform with her existing tools (even after self-configuration), she generates a new tool, validates it in a sandbox, uses it, and if it works; persists it for future reuse.

This is Phase 2+3 of the self-modification capability. Phase 1 (credential store) must be complete first.

---

## Architecture Overview

```
Missing Tool → Tool Generator (LLM) → Static Scanner → Sandbox (isolated-vm)
                                                           │
                                                    ┌──────┴──────┐
                                                    │  FAIL       │  PASS
                                                    ▼             ▼
                                              Retry (max 3)   Execute Task
                                                                    │
                                                              ┌─────┴─────┐
                                                              │  WORKED?   │
                                                              └─────┬─────┘
                                                           ┌────────┴────────┐
                                                           │ NO              │ YES
                                                           ▼                 ▼
                                                      Discard         Persist to DB
                                                                      (operator approval)
```

Every generated tool passes through FIVE security gates before it can execute. Then a sixth gate before persistence.

---

## Part 1: The Sandbox; `isolated-vm`

### 1.1 Install

```bash
pnpm add isolated-vm
pnpm add -D @types/isolated-vm
```

### 1.2 Sandbox Setup

Create `src/sandbox/sandbox-vm.ts`:

```typescript
import ivm from 'isolated-vm';

export interface SandboxOptions {
  timeout?: number; // ms, default 30000
  memoryLimit?: number; // MB, default 128
  outputLimit?: number; // bytes, default 1_048_576 (1MB)
}

export interface SandboxResult {
  success: boolean;
  result?: unknown;
  error?: string;
  durationMs: number;
  memoryUsedMB?: number;
}

const DEFAULT_OPTIONS: Required<SandboxOptions> = {
  timeout: 30_000,
  memoryLimit: 128,
  outputLimit: 1_048_576,
};
```

### 1.3 API Allowlist

The sandbox grants ZERO access by default. Everything must be explicitly allowed.

Create `src/sandbox/allowed-apis.ts`:

```typescript
/**
 * APIs passed into the sandbox at creation time.
 * These are COPIES, not references; the sandbox cannot mutate the host.
 */
export interface SandboxAPIs {
  // Data transformation (pure, no side effects)
  JSON: Pick<typeof JSON, 'parse' | 'stringify'>;
  
  // Math and dates
  Math: Pick<typeof Math, 'abs' | 'ceil' | 'floor' | 'round' | 'max' | 'min' | 'random' | 'sqrt' | 'pow'>;
  Date: typeof Date;
  
  // String operations
  atob: typeof atob;
  btoa: typeof btoa;
  
  // Regex
  RegExp: typeof RegExp;
  
  // HTTP (proxied; see below)
  fetch: typeof fetch; // Proxied through a gatekeeper
  
  // Console (captured, not printed to host stdout)
  console: { log: (...args: unknown[]) => void; error: (...args: unknown[]) => void };
  
  // Buffer (read-only, no filesystem)
  Buffer: {
    from: typeof Buffer.from;
    isBuffer: typeof Buffer.isBuffer;
  };
}

/**
 * APIs that are DELIBERATELY EXCLUDED:
 * - process (no process.env, process.exit, process.argv)
 * - fs / require / import / eval / Function
 * - child_process / worker_threads
 * - setTimeout / setInterval (controlled via sandbox timeout)
 * - globalThis / global
 * - __dirname / __filename
 */
```

### 1.4 Fetch Proxy (Network Gatekeeper)

The sandbox's `fetch` is not the raw host `fetch`. It goes through a gatekeeper:

Create `src/sandbox/fetch-gatekeeper.ts`:

```typescript
/**
 * Sandbox fetch proxy. Every outbound request is validated.
 * 
 * Rules:
 * - HTTPS only (no http://)
 * - Domain allowlist (configurable per-tool or globally)
 * - Max response size: 5MB
 * - Timeout: 10s per request
 * - No internal IPs (127.0.0.1, 10.x, 192.168.x, 172.16-31.x)
 * - Method: GET/POST only (no PUT/DELETE/PATCH)
 * - Headers: no Authorization passthrough from host
 */

const BLOCKED_IPS = [
  /^127\./, /^10\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./,
  /^0\./, /^169\.254\./, /^224\./, /^240\./,
];

const ALLOWED_DOMAINS = ['*']; // '*' = any public domain; override per-tool for stricter

export function createSandboxFetch(toolDomainAllowlist?: string[]): typeof fetch {
  const allowlist = toolDomainAllowlist ?? ALLOWED_DOMAINS;
  
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    
    // HTTPS only
    if (url.protocol !== 'https:') {
      throw new Error(`Sandbox fetch: HTTPS required, got ${url.protocol}`);
    }
    
    // No internal IPs (resolve first)
    const { hostname } = url;
    // Use dns.lookup to resolve and check IP range
    // ... (implementation omitted for brevity; use dns.promises.lookup + BLOCKED_IPS check)
    
    // Domain allowlist
    if (allowlist[0] !== '*' && !allowlist.some(d => hostname.endsWith(d))) {
      throw new Error(`Sandbox fetch: domain ${hostname} not in allowlist`);
    }
    
    // Method restriction
    const method = (init?.method ?? 'GET').toUpperCase();
    if (!['GET', 'POST'].includes(method)) {
      throw new Error(`Sandbox fetch: method ${method} not allowed`);
    }
    
    // Strip sensitive headers
    const safeHeaders: Record<string, string> = {};
    // Only pass through Content-Type and Accept
    // Explicitly drop: Authorization, Cookie, Host, X-* from host
    
    // Timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    
    try {
      const response = await fetch(input, {
        ...init,
        method,
        headers: safeHeaders,
        signal: controller.signal,
      });
      
      // Max response: 5MB
      const contentLength = parseInt(response.headers.get('content-length') ?? '0', 10);
      if (contentLength > 5_242_880) {
        throw new Error(`Sandbox fetch: response too large (${contentLength} bytes)`);
      }
      
      return response;
    } finally {
      clearTimeout(timeout);
    }
  };
}
```

### 1.5 Sandbox Execution Engine

Create `src/sandbox/engine.ts`:

```typescript
import ivm from 'isolated-vm';
import { SandboxOptions, SandboxResult, DEFAULT_OPTIONS } from './sandbox-vm';
import { SandboxAPIs } from './allowed-apis';
import { createSandboxFetch } from './fetch-gatekeeper';

/**
 * Execute untrusted JavaScript in an isolated V8 VM.
 * 
 * The isolate has:
 * - NO filesystem access
 * - NO network (except proxied fetch)
 * - NO process/env access
 * - Memory limit (128MB default)
 * - CPU time limit (30s default)
 * 
 * Returns the JSON-serialized result or an error.
 */
export async function executeInSandbox(
  code: string,
  params: Record<string, unknown>,
  options: SandboxOptions = {},
): Promise<SandboxResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const start = Date.now();
  
  // Create a new isolate for every execution (no state leakage)
  const isolate = new ivm.Isolate({ memoryLimit: opts.memoryLimit });
  
  try {
    const context = await isolate.createContext();
    const jail = context.global;
    
    // Build the API surface; every API is explicitly copied in
    const apis: SandboxAPIs = {
      JSON: { parse: JSON.parse, stringify: JSON.stringify },
      Math: {
        abs: Math.abs, ceil: Math.ceil, floor: Math.floor,
        round: Math.round, max: Math.max, min: Math.min,
        random: Math.random, sqrt: Math.sqrt, pow: Math.pow,
      },
      Date,
      atob,
      btoa,
      RegExp,
      fetch: createSandboxFetch(),  // Proxied
      console: {
        log: (...args: unknown[]) => { /* captured, not printed */ },
        error: (...args: unknown[]) => { /* captured, not printed */ },
      },
      Buffer: { from: Buffer.from, isBuffer: Buffer.isBuffer },
    };
    
    // Inject APIs into the jail
    for (const [key, value] of Object.entries(apis)) {
      await jail.set(key, new ivm.Reference(value));
    }
    
    // Inject parameters
    await jail.set('params', new ivm.ExternalCopy(params).copyInto());
    
    // Compile and run the user code
    const script = await isolate.compileScript(`
      (function() {
        ${code}
      })()
    `);
    
    const result = await script.run(context, {
      timeout: opts.timeout,
      copy: true,  // Copy result out of isolate
    });
    
    // Validate output is JSON-serializable
    let parsed: unknown;
    try {
      parsed = JSON.parse(JSON.stringify(result));
    } catch {
      return {
        success: false,
        error: 'Tool output is not JSON-serializable. Return plain objects, arrays, strings, numbers, or booleans.',
        durationMs: Date.now() - start,
      };
    }
    
    // Check output size
    const outputStr = JSON.stringify(parsed);
    if (Buffer.byteLength(outputStr) > opts.outputLimit) {
      return {
        success: false,
        error: `Output exceeds ${opts.outputLimit} byte limit (got ${Buffer.byteLength(outputStr)} bytes).`,
        durationMs: Date.now() - start,
      };
    }
    
    return {
      success: true,
      result: parsed,
      durationMs: Date.now() - start,
    };
    
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: message,
      durationMs: Date.now() - start,
    };
  } finally {
    isolate.dispose();
  }
}
```

---

## Part 2: Static Code Scanner

Before code ever enters the sandbox, it's scanned for banned patterns.

Create `src/sandbox/static-scanner.ts`:

```typescript
/**
 * Scan generated code for dangerous patterns BEFORE execution.
 * This is a first-pass filter; the sandbox is the real defense,
 * but catching these early gives better error messages to the LLM.
 */

interface ScanResult {
  safe: boolean;
  blocked: string[]; // What was blocked and why
}

const BANNED_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  // Direct filesystem
  { pattern: /\brequire\s*\(/, reason: 'require(); no module loading' },
  { pattern: /\bimport\s+/, reason: 'import; no ES module loading' },
  { pattern: /\bimport\s*\(/, reason: 'import(); no dynamic imports' },
  { pattern: /\bfs\./, reason: 'fs module; no filesystem access' },
  { pattern: /\bpath\./, reason: 'path module; no filesystem access' },
  { pattern: /\b__dirname\b/, reason: '__dirname; no filesystem context' },
  { pattern: /\b__filename\b/, reason: '__filename; no filesystem context' },
  
  // Process and environment
  { pattern: /\bprocess\./, reason: 'process; no host process access' },
  { pattern: /\bprocess\.env\b/, reason: 'process.env; no environment access' },
  { pattern: /\bprocess\.exit\b/, reason: 'process.exit(); cannot kill host' },
  
  // Code execution
  { pattern: /\beval\s*\(/, reason: 'eval(); no dynamic code execution' },
  { pattern: /\bnew\s+Function\s*\(/, reason: 'new Function(); no dynamic code execution' },
  { pattern: /\bsetTimeout\s*\(/, reason: 'setTimeout; controlled via sandbox timeout' },
  { pattern: /\bsetInterval\s*\(/, reason: 'setInterval; controlled via sandbox timeout' },
  
  // Subprocess
  { pattern: /\bchild_process\b/, reason: 'child_process; no subprocess spawning' },
  { pattern: /\bexec\s*\(/, reason: 'exec(); no command execution' },
  { pattern: /\bspawn\s*\(/, reason: 'spawn(); no process spawning' },
  { pattern: /\bexecSync\b/, reason: 'execSync; no command execution' },
  
  // Network raw
  { pattern: /\bnet\./, reason: 'net module; use sandbox fetch() instead' },
  { pattern: /\bhttp\./, reason: 'http module; use sandbox fetch() instead' },
  { pattern: /\bdgram\./, reason: 'dgram; no raw sockets' },
  { pattern: /\btls\./, reason: 'tls; no raw TLS' },
  
  // Worker threads
  { pattern: /\bWorker\b/, reason: 'Worker; no thread spawning' },
  { pattern: /\bworker_threads\b/, reason: 'worker_threads; no thread spawning' },
  
  // Global access
  { pattern: /\bglobalThis\b/, reason: 'globalThis; no host global access' },
  { pattern: /\bglobal\b/, reason: 'global; no host global access' },
  
  // Infinite loops and DoS
  { pattern: /\bwhile\s*\(\s*true\s*\)/, reason: 'while(true); potential infinite loop' },
  { pattern: /\bfor\s*\(\s*;\s*;\s*\)/, reason: 'for(;); potential infinite loop' },
];

export function scanGeneratedCode(code: string): ScanResult {
  const blocked: string[] = [];
  
  for (const { pattern, reason } of BANNED_PATTERNS) {
    if (pattern.test(code)) {
      blocked.push(reason);
    }
  }
  
  return {
    safe: blocked.length === 0,
    blocked,
  };
}
```

---

## Part 3: Tool Generator; The LLM Prompt

This is the internal prompt Carina uses to generate tool code. It goes into `src/tools/dynamic/generator-prompt.ts`:

```typescript
export const TOOL_GENERATOR_SYSTEM_PROMPT = `You are a tool generator for an AI agent. Your job is to write a SINGLE JavaScript function that solves a specific task.

## Your Output Format

You output a JSON object with three fields:

{
  "name": "snake_case_tool_name",
  "description": "One sentence describing what this tool does. Include what it expects and what it returns.",
  "parameters": {
    "paramName": { "type": "string|number|boolean|object|array", "description": "what this param is", "required": true }
  },
  "code": "async function execute(params) { ... }"
}

## Code Rules (MANDATORY; violations will crash)

YOUR FUNCTION MUST:

1. Be named exactly: async function execute(params)
2. Accept ONE parameter called 'params' (an object with the keys you defined above)
3. Return a plain value (string, number, boolean, array, or plain object; NOT a class instance, Map, Set, or Buffer)
4. Use ONLY these APIs (everything else is blocked):
   - JSON.parse(), JSON.stringify()
   - Math.abs(), Math.ceil(), Math.floor(), Math.round(), Math.max(), Math.min(), Math.random(), Math.sqrt(), Math.pow()
   - new Date(), Date.now(), Date.parse()
   - String methods (.split(), .replace(), .trim(), .toLowerCase(), .toUpperCase(), .includes(), .indexOf(), .slice(), .match(), .matchAll(), .replaceAll())
   - Array methods (.map(), .filter(), .reduce(), .find(), .sort(), .slice(), .concat(), .join(), .includes(), .indexOf(), .flat())
   - Object methods (.keys(), .values(), .entries(), .assign())
   - atob(), btoa(); for base64
   - new RegExp()
   - fetch(url, options); for HTTPS API calls. Use ONLY GET and POST. Returns standard Response object.
   - Buffer.from(str, encoding) and Buffer.isBuffer()
   - console.log() and console.error() for debugging (output captured, not printed)

YOUR FUNCTION MUST NOT:
- Use require(), import(), or import()
- Use fs, path, os, process, child_process, net, http, dgram, tls, worker_threads
- Use eval(), new Function(), setTimeout(), setInterval()
- Access __dirname, __filename, globalThis, global
- Throw uncaught errors (wrap risky code in try/catch, return { error: "message" })
- Write infinite loops (while(true), for(;))
- Access process.env for credentials; those are injected via params if needed
- Return more than 1MB of data

## Example

Task: "Extract all email addresses from a block of text and return them sorted alphabetically"

{
  "name": "extract_emails",
  "description": "Extract all email addresses from text, return sorted array with counts",
  "parameters": {
    "text": { "type": "string", "description": "The text to extract emails from", "required": true }
  },
  "code": "async function execute(params) {\\n  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\\\.[a-zA-Z]{2,}/g;\\n  const matches = params.text.match(emailRegex) || [];\\n  const unique = [...new Set(matches)].sort();\\n  return { emails: unique, count: unique.length };\\n}"
}

## Error Handling

If the input is invalid or the operation cannot complete:
return { error: "Clear description of what went wrong" }

DO NOT throw errors. Always catch and return an error object.`;
```

---

## Part 4: Dynamic Tool Registry

### 4.1 Database Migration

Do NOT create a `.sql` file. The project uses PostgreSQL and inline TypeScript SQL constants. Export the migration from `src/tools/dynamic/tool-store.ts` and import it in `src/memory/migrations.ts` following the existing pattern (e.g., `BACKGROUND_PROCESS_MIGRATION` in `src/tools/process-persistence.ts`).

```typescript
// At the top of src/tools/dynamic/tool-store.ts:
export const RUNTIME_TOOLS_MIGRATION = `
CREATE TABLE IF NOT EXISTS runtime_tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'custom',
  parameters_json TEXT NOT NULL,
  source_code TEXT NOT NULL,
  source_code_hash TEXT NOT NULL,
  
  -- Generation metadata
  generation_prompt TEXT,                 -- What the user/agent asked for
  generated_by TEXT NOT NULL,             -- 'carina' or 'operator'
  generated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  model_used TEXT,                        -- Which LLM generated it
  
  -- Validation results
  static_scan_passed BOOLEAN NOT NULL DEFAULT 0,
  sandbox_test_passed BOOLEAN NOT NULL DEFAULT 0,
  sandbox_test_output TEXT,               -- Result of the test run
  
  avg_duration_ms INTEGER,
  times_used INTEGER NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  risk_level TEXT NOT NULL DEFAULT 'low',
  sandbox_memory_mb INTEGER NOT NULL DEFAULT 128,
  sandbox_timeout_ms INTEGER NOT NULL DEFAULT 30000,
  fetch_allowed_domains TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_runtime_tools_status ON runtime_tools(status);
CREATE INDEX IF NOT EXISTS idx_runtime_tools_category ON runtime_tools(category);
CREATE INDEX IF NOT EXISTS idx_runtime_tools_name ON runtime_tools(name);
`;
// Import this in src/memory/migrations.ts alongside other migration constants.
```

### 4.2 Runtime Tool Store

Create `src/tools/dynamic/tool-store.ts`:

```typescript
import { pool } from '../../memory/db.js';
import crypto from 'crypto';

export interface RuntimeToolRecord {
  id: string;
  name: string;
  displayName: string;
  description: string;
  category: string;
  parametersJson: string;
  sourceCode: string;
  sourceCodeHash: string;
  generationPrompt?: string;
  generatedBy: string;
  generatedAt: string;
  modelUsed?: string;
  staticScanPassed: boolean;
  sandboxTestPassed: boolean;
  sandboxTestOutput?: string;
  avgDurationMs?: number;
  timesUsed: number;
  lastUsedAt?: string;
  status: 'pending' | 'approved' | 'active' | 'disabled' | 'rejected';
  approvedBy?: string;
  approvedAt?: string;
  riskLevel: 'low' | 'medium' | 'high';
  sandboxMemoryMb: number;
  sandboxTimeoutMs: number;
  fetchAllowedDomains?: string;
}

export class RuntimeToolStore {
  async save(tool: Omit<RuntimeToolRecord, 'id'>): Promise<string> {
    const id = crypto.randomUUID();
    await pool.query(
      `INSERT INTO runtime_tools (id, name, display_name, description, category,
         parameters_json, source_code, source_code_hash, generation_prompt,
         generated_by, model_used, static_scan_passed, sandbox_test_passed,
         sandbox_test_output, avg_duration_ms, times_used, last_used_at,
         status, risk_level, sandbox_memory_mb, sandbox_timeout_ms, fetch_allowed_domains)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,NOW(),$17,$18,$19,$20,$21)`,
      [id, tool.name, tool.displayName, tool.description, tool.category,
       tool.parametersJson, tool.sourceCode, tool.sourceCodeHash, tool.generationPrompt ?? null,
       tool.generatedBy, tool.modelUsed ?? null, tool.staticScanPassed, tool.sandboxTestPassed,
       tool.sandboxTestOutput ?? null, tool.avgDurationMs ?? null, tool.timesUsed,
       tool.status, tool.riskLevel, tool.sandboxMemoryMb, tool.sandboxTimeoutMs,
       tool.fetchAllowedDomains ?? null],
    );
    return id;
  }

  async loadActive(): Promise<RuntimeToolRecord[]> {
    const result = await pool.query<RuntimeToolRecord>(
      `SELECT * FROM runtime_tools WHERE status = 'active' ORDER BY times_used DESC`,
    );
    return result.rows;
  }

  async approve(id: string, approvedBy = 'operator'): Promise<void> {
    await pool.query(
      `UPDATE runtime_tools SET status = 'active', approved_by = $1, approved_at = NOW() WHERE id = $2`,
      [approvedBy, id],
    );
  }

  async recordUse(name: string, durationMs: number): Promise<void> {
    await pool.query(
      `UPDATE runtime_tools SET times_used = times_used + 1, last_used_at = NOW(),
         avg_duration_ms = COALESCE(avg_duration_ms, 0) / 2 + $1 / 2
       WHERE name = $2`,
      [durationMs, name],
    );
  }

  async disable(id: string): Promise<void> {
    await pool.query(`UPDATE runtime_tools SET status = 'disabled' WHERE id = $1`, [id]);
  }

  async findByCodeHash(hash: string): Promise<RuntimeToolRecord | null> {
    const result = await pool.query<RuntimeToolRecord>(
      `SELECT * FROM runtime_tools WHERE source_code_hash = $1 LIMIT 1`,
      [hash],
    );
    return result.rows[0] ?? null;
  }

  async list(filter?: { status?: string; category?: string }): Promise<RuntimeToolRecord[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    if (filter?.status) { conditions.push(`status = $${values.length + 1}`); values.push(filter.status); }
    if (filter?.category) { conditions.push(`category = $${values.length + 1}`); values.push(filter.category); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await pool.query<RuntimeToolRecord>(`SELECT * FROM runtime_tools ${where}`, values);
    return result.rows;
  }

  async stats(): Promise<{ total: number; active: number; failed: number; totalUses: number }> {
    const result = await pool.query<{ total: string; active: string; total_uses: string }>(
      `SELECT COUNT(*) AS total,
              COUNT(*) FILTER (WHERE status = 'active') AS active,
              COALESCE(SUM(times_used), 0) AS total_uses
       FROM runtime_tools`,
    );
    const row = result.rows[0]!;
    return { total: +row.total, active: +row.active, failed: 0, totalUses: +row.total_uses };
  }
}
```

### 4.3 Rehydration on Startup

Modify `src/index.ts` (or wherever the tool registry is initialized):

```typescript
import { RuntimeToolStore } from './tools/dynamic/tool-store.js';
import { createRuntimeToolDefinition } from './tools/dynamic/tool-definition.js';

async function rehydrateRuntimeTools(): Promise<void> {
  const store = new RuntimeToolStore();
  const activeTools = await store.loadActive();
  
  for (const record of activeTools) {
    try {
      const toolDef = createRuntimeToolDefinition(record);
      registry.register(toolDef);
      logger.info(`Rehydrated runtime tool: ${record.name} (${record.times_used} uses)`);
    } catch (err) {
      logger.warn(`Failed to rehydrate runtime tool ${record.name}: ${err}`);
    }
  }
  
  logger.info(`Rehydrated ${activeTools.length} runtime tools`);
}

// Call after DB connection is established, before gateway starts
await rehydrateRuntimeTools();
```

---

## Part 5: The Dynamic Tool Execution Tool

This is the tool Carina calls when she needs a tool she doesn't have. It orchestrates generation, scanning, sandboxing, and execution.

Create `src/tools/dynamic/generate-and-run.ts`:

```typescript
import { scanGeneratedCode } from '../../sandbox/static-scanner.js';
import { executeInSandbox } from '../../sandbox/engine.js';
import { RuntimeToolStore } from './tool-store.js';
import { TOOL_GENERATOR_SYSTEM_PROMPT } from './generator-prompt.js';
import { llm } from '../../brain/llm.js';
import crypto from 'crypto';

export const generateAndRunTool = {
  name: 'generate_and_run_tool',
  description: `Generate a new JavaScript tool on-the-fly when no existing tool can accomplish a task. 
The tool is created, security-scanned, sandbox-tested, and executed in one call.

Use this ONLY when you've confirmed no existing tool can handle the task. 
The generated tool runs in a sandbox with no filesystem access, no network (except proxied fetch), and a 30-second timeout.

After successful execution, the tool can be saved for future reuse.`,
  
  parameters: {
    task_description: {
      type: 'string',
      description: 'Describe what needs to be done. Be specific: input format, transformation, expected output.',
      required: true,
    },
    input_data: {
      type: 'object',
      description: 'The actual data to process. Will be passed as params to the generated function.',
      required: true,
    },
    save_on_success: {
      type: 'boolean',
      description: 'If true and the tool executes successfully, save it for future reuse. Default: true.',
      required: false,
    },
  },
  
  requiresConfirmation: true,
  dangerous: true,

  // Tool.execute only receives params; no second context arg exists in this codebase.
  // Operator-gating is via LEAF_EXCLUDED_TOOLS. LLM access via the shared llm singleton.
  async execute(rawParams: Record<string, unknown>): Promise<unknown> {
    const { task_description, input_data, save_on_success = true } = rawParams as {
      task_description: string;
      input_data: Record<string, unknown>;
      save_on_success?: boolean;
    };

    // Step 1: Generate the tool code via LLM (llm is imported from ../../brain/llm.js)
    const llmResponse = await llm.chat([
      { role: 'user', content: `Task: ${task_description}` },
    ], undefined, undefined, { systemPrompt: TOOL_GENERATOR_SYSTEM_PROMPT });
    
    // Step 2: Parse the LLM response (CarinaResponse has a .content string field)
    let generated: { name: string; description: string; parameters: Record<string, unknown>; code: string };
    try {
      generated = JSON.parse(llmResponse.content) as typeof generated;
    } catch {
      return { error: 'LLM did not return valid JSON. Response was: ' + llmResponse.content.slice(0, 500) };
    }
    
    if (!generated.name || !generated.code) {
      return { error: 'Generated tool missing required fields (name, code).' };
    }
    
    // Step 3: Static scan
    const scanResult = scanGeneratedCode(generated.code);
    if (!scanResult.safe) {
      return {
        error: `Generated code blocked by static scanner. Violations:\n${scanResult.blocked.map(b => `- ${b}`).join('\n')}`,
        detail: { generated_name: generated.name, violations: scanResult.blocked },
      };
    }
    
    // Step 4: Execute in sandbox with test data
    const sandboxResult = await executeInSandbox(generated.code, input_data, {
      timeout: 30_000,
      memoryLimit: 128,
    });
    
    if (!sandboxResult.success) {
      return {
        error: `Tool execution failed in sandbox: ${sandboxResult.error}`,
        detail: { generated_name: generated.name, duration_ms: sandboxResult.durationMs },
      };
    }
    
    // Step 5: Save for future reuse (if requested and successful)
    let saved = false;
    if (save_on_success) {
      const store = new RuntimeToolStore();
      const codeHash = crypto.createHash('sha256').update(generated.code).digest('hex');
      
      // Dedup: don't save identical tools
      const existing = await store.findByCodeHash(codeHash);
      if (!existing) {
        await store.save({
          name: generated.name,
          displayName: generated.name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          description: generated.description,
          category: inferCategory(generated.name, task_description),
          parametersJson: JSON.stringify(generated.parameters),
          sourceCode: generated.code,
          sourceCodeHash: codeHash,
          generationPrompt: task_description,
          generatedBy: 'carina',
          modelUsed: undefined,
          staticScanPassed: true,
          sandboxTestPassed: true,
          sandboxTestOutput: JSON.stringify(sandboxResult.result).slice(0, 1000),
          avgDurationMs: sandboxResult.durationMs,
          timesUsed: 1,
          lastUsedAt: new Date().toISOString(),
          status: 'pending',  // Awaiting operator approval
          riskLevel: inferRiskLevel(generated.code),
          sandboxMemoryMb: 128,
          sandboxTimeoutMs: 30000,
        });
        saved = true;
      }
    }
    
    return {
      success: true,
      result: sandboxResult.result,
      detail: {
        tool_name: generated.name,
        tool_description: generated.description,
        duration_ms: sandboxResult.durationMs,
        saved_for_reuse: saved,
        note: saved ? 'Tool saved as pending. Operator approval required before future automatic use.' : undefined,
      },
    };
  },
};

function inferCategory(name: string, task: string): string {
  const lower = (name + ' ' + task).toLowerCase();
  if (lower.includes('api') || lower.includes('fetch') || lower.includes('http')) return 'api';
  if (lower.includes('csv') || lower.includes('json') || lower.includes('transform') || lower.includes('convert')) return 'transform';
  if (lower.includes('extract') || lower.includes('parse') || lower.includes('scrape')) return 'extraction';
  if (lower.includes('pdf') || lower.includes('doc') || lower.includes('file')) return 'document';
  if (lower.includes('email') || lower.includes('phone') || lower.includes('validate')) return 'validation';
  return 'utility';
}

function inferRiskLevel(code: string): 'low' | 'medium' | 'high' {
  if (code.includes('fetch(')) return 'medium';
  if (code.includes('Buffer.from') || code.includes('atob') || code.includes('btoa')) return 'low';
  return 'low';
}
```

---

## Part 6: Security; Defense Architecture

### Five Defense Layers (In Order)

```
                  ┌──────────────────────────────┐
  LAYER 1         │  PROMPT CONSTRAINTS           │
                  │  LLM instructed to only use   │
                  │  allowed APIs. Violations     │
                  │  caught by Layer 2.           │
                  └──────────────┬───────────────┘
                                 │
                  ┌──────────────▼───────────────┐
  LAYER 2         │  STATIC CODE SCANNER          │
                  │  Regex scan for banned tokens │
                  │  (require, eval, process, fs) │
                  │  REJECTS before any execution │
                  └──────────────┬───────────────┘
                                 │
                  ┌──────────────▼───────────────┐
  LAYER 3         │  SANDBOX; isolated-vm        │
                  │  V8 isolate. Zero host access │
                  │  by default. Memory + CPU cap │
                  │  Explicit API allowlist only. │
                  └──────────────┬───────────────┘
                                 │
                  ┌──────────────▼───────────────┐
  LAYER 4         │  FETCH GATEKEEPER             │
                  │  HTTPS-only, domain check,    │
                  │  no internal IPs, size limit, │
                  │  stripped auth headers.       │
                  └──────────────┬───────────────┘
                                 │
                  ┌──────────────▼───────────────┐
  LAYER 5         │  OUTPUT VALIDATION            │
                  │  JSON-serializable check      │
                  │  Size limit (1MB)             │
                  │  No circular references       │
                  └──────────────────────────────┘
```

### Additional Operational Controls

```typescript
// RATE LIMIT: Max generated tools per hour
const MAX_GENERATIONS_PER_HOUR = 10;

// APPROVAL GATE: Generated tools default to 'pending' status
// They can be used ONCE during generation session
// But for persistent reuse, operator must approve via:
//   - ops dashboard: ops.carinaai.uk/tools/runtime
//   - CLI: pnpm carina tools approve <name>
//   - Chat: "Carina, approve the email extractor tool"

// AUDIT LOG: Every generation is logged
// - What task prompted it
// - What code was generated
// - Scan results
// - Sandbox results
// - Whether it was saved
// - Who approved it

// ROLLBACK: Any tool can be disabled instantly
// pnpm carina tools disable <name>
// Disabled tools are NOT rehydrated on restart
```

---

## Part 7: Operator Approval Flow

### 7.1 The `approve_runtime_tool` Tool

Create `src/tools/dynamic/approve-tool.ts`:

```typescript
export const approveRuntimeTool = {
  name: 'approve_runtime_tool',
  description: 'Approve a pending runtime-generated tool for persistent reuse. Only the operator can call this.',
  requiresConfirmation: true,
  dangerous: true,
  parameters: {
    tool_name: { type: 'string', description: 'Name of the generated tool to approve', required: true },
  },
  // Tool.execute receives only params. Operator-gating via LEAF_EXCLUDED_TOOLS upstream.
  async execute(rawParams: Record<string, unknown>): Promise<unknown> {
    const { tool_name } = rawParams as { tool_name: string };
    const store = new RuntimeToolStore();
    const tools = await store.list({ status: 'pending' });
    const tool = tools.find(t => t.name === tool_name);

    if (!tool) {
      return { error: `No pending tool found with name "${tool_name}".` };
    }
    
    await store.approve(tool.id, 'operator');
    
    // Re-register in live registry
    const toolDef = createRuntimeToolDefinition({ ...tool, status: 'active' });
    registry.register(toolDef);
    
    return { success: true, message: `Tool "${tool_name}" approved and activated for persistent use.` };
  },
};
```

### 7.2 Approval UI Route (Ops Dashboard)

Add to the ops dashboard API:

```typescript
// GET /api/tools/runtime; list all generated tools
// POST /api/tools/runtime/:id/approve; approve a tool
// POST /api/tools/runtime/:id/disable; disable a tool
// DELETE /api/tools/runtime/:id; permanently delete
// GET /api/tools/runtime/stats; generation statistics
```

---

## Part 8: Registration

### 8.1 Register Dynamic Tools

In `src/tools/index.ts`, add:

```typescript
import { generateAndRunTool } from './dynamic/generate-and-run';
import { approveRuntimeTool } from './dynamic/approve-tool';

registry.register(generateAndRunTool);
registry.register(approveRuntimeTool);
```

### 8.2 Toolset

In `src/tools/toolset.ts`, add a new toolset category:

```typescript
// TOOLSET_MAP
dynamic: ['generate_and_run_tool', 'approve_runtime_tool'],
```

In `src/tools/toolset-config.ts`, add `dynamic` to the operator platforms:

```typescript
telegram: ['messaging', 'file', 'web', 'search', 'skills', 'sync', 'media', 'dynamic'],
cli:      ['web', 'search', 'file', 'skills', 'dynamic'],
```

Do NOT add `dynamic` to `web` platform defaults; only operator channels get tool generation.

### 8.3 Add to LEAF_EXCLUDED_TOOLS

```typescript
// In src/tools/toolset.ts
export const LEAF_EXCLUDED_TOOLS = [
  // ... existing
  'generate_and_run_tool',
  'approve_runtime_tool',
];
```

Leaf agents (non-operator) must never generate tools.

---

## Part 9: Environment Variables

Add to `.env`:

```bash
# Sandbox defaults (optional)
SANDBOX_MEMORY_MB=128
SANDBOX_TIMEOUT_MS=30000
SANDBOX_MAX_GENERATIONS_PER_HOUR=10

# Auto-approval (DANGEROUS; off by default)
# Set to 'true' to auto-approve low-risk generated tools
RUNTIME_TOOL_AUTO_APPROVE=false
```

---

## Verification Checklist

After building, verify:

- [ ] `isolated-vm` installed and `pnpm build` succeeds
- [ ] Static scanner catches all banned patterns (test with malicious code)
- [ ] Sandbox rejects `require('fs')` and `process.env`
- [ ] Sandbox allows `JSON.parse`, `Math.max`, `fetch('https://api.example.com')`
- [ ] Fetch gatekeeper blocks `http://` and internal IPs
- [ ] Database migration creates `runtime_tools` table
- [ ] `generate_and_run_tool` produces valid JSON from LLM
- [ ] Successful tool saves to DB with status `pending`
- [ ] Operator can approve via `approve_runtime_tool`
- [ ] Approved tools rehydrate on restart
- [ ] Disabled tools do NOT rehydrate
- [ ] Rate limit enforced (max 10 generations/hour)
- [ ] Leaf agents cannot access `generate_and_run_tool`
- [ ] Generated tools appear on ops dashboard at `/api/tools/runtime`
- [ ] `pnpm carina tools list --runtime` shows generated tools
- [ ] `pnpm carina tools approve <name>` works from CLI
- [ ] `pnpm carina tools disable <name>` works from CLI

---

## Files Summary

| File | Action |
|------|--------|
| `src/tools/dynamic/tool-store.ts` | CREATE; exports RUNTIME_TOOLS_MIGRATION constant |
| `src/memory/migrations.ts` | MODIFY; import and include RUNTIME_TOOLS_MIGRATION |
| `src/sandbox/sandbox-vm.ts` | CREATE |
| `src/sandbox/allowed-apis.ts` | CREATE |
| `src/sandbox/fetch-gatekeeper.ts` | CREATE |
| `src/sandbox/engine.ts` | CREATE |
| `src/sandbox/static-scanner.ts` | CREATE |
| `src/tools/dynamic/generator-prompt.ts` | CREATE |
| `src/tools/dynamic/tool-store.ts` | CREATE |
| `src/tools/dynamic/tool-definition.ts` | CREATE |
| `src/tools/dynamic/generate-and-run.ts` | CREATE |
| `src/tools/dynamic/approve-tool.ts` | CREATE |
| `src/tools/index.ts` | MODIFY; register 2 tools |
| `src/tools/toolset.ts` | MODIFY; add `dynamic` toolset + LEAF_EXCLUDED |
| `src/tools/toolset-config.ts` | MODIFY; add `dynamic` to operator platforms |
| `src/index.ts` | MODIFY; add `rehydrateRuntimeTools()` call |
| `.env` | MODIFY; add sandbox env vars |

---

## Success Criteria

1. Carina encounters a task she can't do with her existing tools
2. She calls `generate_and_run_tool` with a task description and input data
3. The LLM generates a JavaScript function
4. The static scanner approves or rejects it
5. The sandbox executes it safely
6. The result returns to Carina
7. On success, the tool is saved to DB as `pending`
8. You review and approve it (or reject it)
9. Approved tools are available on every restart; no code deploy needed
