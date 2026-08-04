import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import crypto from 'crypto';
import { pool } from '../memory/db.js';
import { llm } from '../brain/llm.js';
import { registry } from '../tools/registry.js';
import { RuntimeToolStore } from '../tools/dynamic/tool-store.js';
import { createRuntimeToolDefinition } from '../tools/dynamic/tool-definition.js';
import { validateAllPaths, EXTENSION_ALLOWED_ROOT } from './extension-scope.js';
import { logSelfModEvent } from '../security/self-mod-logger.js';
import { scanGeneratedCode } from '../sandbox/static-scanner.js';

const execFileAsync = promisify(execFile);

const REPO_ROOT = path.resolve(process.env.CARINA_REPO_ROOT ?? process.cwd());

export const EXTENSION_MUTATIONS_MIGRATION = `
CREATE TABLE IF NOT EXISTS extension_mutations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       TEXT NOT NULL,
  task            TEXT NOT NULL,
  file_path       TEXT NOT NULL,
  source_code     TEXT NOT NULL,
  compile_passed  BOOLEAN NOT NULL DEFAULT FALSE,
  compile_output  TEXT,
  test_passed     BOOLEAN NOT NULL DEFAULT FALSE,
  test_output     TEXT,
  scope_valid     BOOLEAN NOT NULL DEFAULT FALSE,
  status          TEXT NOT NULL DEFAULT 'staged'
                  CHECK (status IN ('staged','approved','rejected','rolled_back')),
  requested_by    TEXT NOT NULL DEFAULT 'operator',
  approved_by     TEXT,
  approved_at     TIMESTAMPTZ,
  tool_id         UUID REFERENCES runtime_tools(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_em_tenant_status ON extension_mutations(tenant_id, status);
`;

export interface ExtensionRequest {
  task: string;
  tenantId: string;
  requestedBy: string;
  runTests?: boolean;
}

export interface ExtensionResult {
  mutationId: string | null;
  filePath: string | null;
  sourceCode: string | null;
  compileOutput: string | null;
  testOutput: string | null;
  compilePassed: boolean;
  testPassed: boolean;
  scopeValid: boolean;
  success: boolean;
  error?: string;
}

const EXTENSION_SYSTEM_PROMPT = `You are writing a TypeScript tool for Carina's extension directory.

Rules:
- Export a single const named after the tool (camelCase).
- The const must have shape: { name: string, description: string, parameters: object, execute: (params) => Promise<unknown> }
- name must be snake_case, under 40 chars.
- No imports outside of Node.js built-ins (fs, path, crypto, etc.). No relative imports.
- No network access unless the task requires it and the operator specifies allowed domains.
- No filesystem access outside the current working directory.
- Under 150 lines total.
- Return the TypeScript source only. No prose, no markdown code fences.`;

export async function requestExtension(req: ExtensionRequest): Promise<ExtensionResult> {
  if (process.env.CARINA_MUTATION_EXTENSIONS !== 'true') {
    return {
      mutationId: null, filePath: null, sourceCode: null, compileOutput: null,
      testOutput: null, compilePassed: false, testPassed: false, scopeValid: false,
      success: false, error: 'CARINA_MUTATION_EXTENSIONS is not enabled',
    };
  }

  void logSelfModEvent('EXTENSION_REQUESTED', {
    task: req.task.slice(0, 200),
    tenant_id: req.tenantId,
  });

  const now = new Date();
  const llmResponse = await llm.chat([
    { role: 'system', content: EXTENSION_SYSTEM_PROMPT, timestamp: now },
    { role: 'user', content: `Task: ${req.task}`, timestamp: now },
  ]);

  const sourceCode = llmResponse.content.trim();
  if (!sourceCode || sourceCode.length < 50) {
    return makeFailResult('LLM returned empty or too-short source code');
  }

  const nameMatch = sourceCode.match(/name:\s*['"]([a-z_][a-z0-9_]*)['"]/);
  if (!nameMatch) {
    return makeFailResult('Could not extract tool name from generated source');
  }
  const toolName = nameMatch[1]!;
  const fileName = `${toolName}.ts`;
  const filePath = `${EXTENSION_ALLOWED_ROOT}${fileName}`;

  const scopeCheck = validateAllPaths([filePath]);
  if (!scopeCheck.valid) {
    return makeFailResult(`Scope violation: ${scopeCheck.violations.join('; ')}`, false);
  }

  const scanResult = scanGeneratedCode(sourceCode);
  if (!scanResult.safe) {
    return makeFailResult(`Static scan blocked: ${scanResult.blocked.join('; ')}`);
  }

  const absPath = path.join(REPO_ROOT, filePath);
  await fs.mkdir(path.dirname(absPath), { recursive: true });
  await fs.writeFile(absPath, sourceCode, 'utf-8');

  let compilePassed = false;
  let compileOutput = '';
  try {
    const result = await execFileAsync('pnpm', ['tsc', '--noEmit', '--strict', filePath], {
      cwd: REPO_ROOT,
      timeout: 30_000,
    });
    compilePassed = true;
    compileOutput = result.stdout + result.stderr;
  } catch (err: unknown) {
    compilePassed = false;
    compileOutput = err instanceof Error && 'stdout' in err
      ? String((err as Record<string, unknown>).stdout) + String((err as Record<string, unknown>).stderr)
      : String(err);
    await fs.unlink(absPath).catch(() => {});
    return {
      mutationId: null, filePath, sourceCode, compileOutput, testOutput: null,
      compilePassed: false, testPassed: false, scopeValid: true, success: false,
      error: 'TypeScript compile failed',
    };
  }

  let testPassed = false;
  let testOutput = '';
  if (req.runTests !== false) {
    const testFile = path.join(REPO_ROOT, `${EXTENSION_ALLOWED_ROOT}${toolName}.test.ts`);
    const testSource = generateMinimalTest(toolName);
    await fs.writeFile(testFile, testSource, 'utf-8');

    try {
      const result = await execFileAsync(
        'pnpm', ['vitest', 'run', `${EXTENSION_ALLOWED_ROOT}${toolName}.test.ts`],
        { cwd: REPO_ROOT, timeout: 60_000 },
      );
      testPassed = true;
      testOutput = result.stdout + result.stderr;
    } catch (err: unknown) {
      testPassed = false;
      testOutput = err instanceof Error && 'stdout' in err
        ? String((err as Record<string, unknown>).stdout) + String((err as Record<string, unknown>).stderr)
        : String(err);
    } finally {
      await fs.unlink(testFile).catch(() => {});
    }
  } else {
    testPassed = true;
    testOutput = '(tests skipped)';
  }

  const mutationId = crypto.randomUUID();
  await pool.query(
    `INSERT INTO extension_mutations
       (id, tenant_id, task, file_path, source_code, compile_passed, compile_output,
        test_passed, test_output, scope_valid, status, requested_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'staged',$11)`,
    [mutationId, req.tenantId, req.task, filePath, sourceCode, compilePassed,
      compileOutput, testPassed, testOutput, true, req.requestedBy],
  );

  void logSelfModEvent('EXTENSION_STAGED', {
    mutation_id: mutationId,
    tool_name: toolName,
    compile_passed: compilePassed,
    test_passed: testPassed,
  });

  return {
    mutationId, filePath, sourceCode, compileOutput, testOutput,
    compilePassed, testPassed, scopeValid: true, success: true,
  };
}

function makeFailResult(error: string, scopeValid = false): ExtensionResult {
  return {
    mutationId: null, filePath: null, sourceCode: null, compileOutput: null,
    testOutput: null, compilePassed: false, testPassed: false, scopeValid,
    success: false, error,
  };
}

function generateMinimalTest(toolName: string): string {
  const camel = toCamelCase(toolName);
  return `import { describe, it, expect } from 'vitest';
import { ${camel} } from './${toolName}.js';

describe('${toolName} extension', () => {
  it('exports required fields', () => {
    expect(${camel}.name).toBe('${toolName}');
    expect(typeof ${camel}.description).toBe('string');
    expect(typeof ${camel}.execute).toBe('function');
  });
});
`;
}

function toCamelCase(s: string): string {
  return s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

export async function approveExtension(mutationId: string, approvedBy: string): Promise<void> {
  const result = await pool.query<{
    id: string; file_path: string; source_code: string; compile_passed: boolean; test_passed: boolean;
  }>(
    `SELECT * FROM extension_mutations WHERE id = $1 AND status = 'staged'`,
    [mutationId],
  );
  const record = result.rows[0];
  if (!record) throw new Error(`No staged extension mutation ${mutationId}`);
  if (!record.compile_passed) throw new Error('Cannot approve: compile failed');

  const toolStore = new RuntimeToolStore();
  const codeHash = crypto.createHash('sha256').update(record.source_code).digest('hex');
  const nameMatch = record.source_code.match(/name:\s*['"]([a-z_][a-z0-9_]*)['"]/);
  const toolName = nameMatch?.[1] ?? path.basename(record.file_path, '.ts');

  const toolId = await toolStore.save({
    name: toolName,
    displayName: toolName.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    description: `Extension tool: ${toolName}`,
    category: 'extension',
    parametersJson: '{}',
    sourceCode: record.source_code,
    sourceCodeHash: codeHash,
    generatedBy: 'extension-harness',
    generatedAt: new Date().toISOString(),
    staticScanPassed: true,
    sandboxTestPassed: record.test_passed,
    timesUsed: 0,
    status: 'active',
    riskLevel: 'low',
    sandboxMemoryMb: 128,
    sandboxTimeoutMs: 30000,
  });

  const toolRecord = await toolStore.findByCodeHash(codeHash);
  if (toolRecord) {
    const toolDef = createRuntimeToolDefinition(toolRecord);
    registry.register(toolDef, { toolset: 'generated' });
  }

  await pool.query(
    `UPDATE extension_mutations SET status = 'approved', approved_by = $1, approved_at = NOW(), tool_id = $2, updated_at = NOW() WHERE id = $3`,
    [approvedBy, toolId, mutationId],
  );

  void logSelfModEvent('EXTENSION_APPROVED', {
    mutation_id: mutationId,
    tool_name: toolName,
    approved_by: approvedBy,
  });
}

export async function rejectExtension(mutationId: string, rejectedBy: string): Promise<void> {
  const result = await pool.query<{ file_path: string }>(
    `UPDATE extension_mutations SET status = 'rejected', updated_at = NOW()
     WHERE id = $1 AND status = 'staged' RETURNING file_path`,
    [mutationId],
  );
  if (!result.rows[0]) throw new Error(`No staged extension mutation ${mutationId}`);

  const absPath = path.join(REPO_ROOT, result.rows[0].file_path);
  await fs.unlink(absPath).catch(() => {});

  void logSelfModEvent('EXTENSION_REJECTED', {
    mutation_id: mutationId,
    rejected_by: rejectedBy,
  });
}
