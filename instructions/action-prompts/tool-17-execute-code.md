# Cursor Task: Fix and test execute-code (#17) tool in Carina

## Context

Carina is a Node.js/TypeScript autonomous AI agent at:
`/opt/lampp/htdocs/verlox/carina/core.carinaai.uk/`

We are hardening the 27 Hermes tools one by one. Tools #10-16 and #18-21 are
confirmed working. This task covers tool #17: `code-exec` (execute_code in Hermes).

Read these files in full before touching anything:
- `src/tools/code.ts` (the tool - needs description update)
- `src/tools/sandbox.ts` (needs one targeted bug fix in `runCodeInSandbox` only)
- `src/tools/shell.test.ts` (read to understand the sandbox mock pattern - do not change)

Do NOT modify any file except:
- `src/tools/code.ts` (description only)
- `src/tools/sandbox.ts` (one function only - `runCodeInSandbox`)
- `src/tools/code.test.ts` (create this file - it does not exist yet)

---

## Bug: Python code runs through JS vm fallback when Docker is unavailable

In `src/tools/sandbox.ts`, `runCodeInSandbox` currently does:

```typescript
export async function runCodeInSandbox(
  code: string,
  language: 'javascript' | 'python',
  options: SandboxOptions,
): Promise<SandboxResult> {
  const useDocker = await checkDocker();
  if (!useDocker) {
    return runJsVmFallback(code, options.timeout);  // always JS vm, regardless of language
  }
  // ...
}
```

When Docker is unavailable and `language === 'python'`, the Python code is passed
to the Node.js `vm` module which produces a confusing JavaScript error
(`SyntaxError: Unexpected token ...` or `ReferenceError: print is not defined`).

### Fix: return a clear error for Python when Docker is unavailable

Change only the `if (!useDocker)` block inside `runCodeInSandbox`:

```typescript
if (!useDocker) {
  if (language === 'python') {
    return {
      stdout: '',
      stderr: 'Python execution requires Docker. Install Docker or use shell-exec with CARINA_DIRECT_SHELL=true to run python3 directly.',
      exitCode: 1,
    };
  }
  return runJsVmFallback(code, options.timeout);
}
```

Do not change any other part of `sandbox.ts`.

---

## Improvement: update the tool description in code.ts

Replace the current `codeExecTool` description with:

```
'Execute JavaScript or Python code and return the output. Docker required for Python (python:3.12-alpine) and for JS isolation (node:22-alpine); falls back to Node.js vm sandbox for JS when Docker is unavailable (no console.log in vm mode - use return value instead). Timeout: 5 seconds. No network access. Code using import, require, or process triggers a confirmation prompt. Language is auto-detected: Python if the code starts lines with def, import, from, or print(; JavaScript otherwise.'
```

---

## Create `src/tools/code.test.ts`

This file does not exist. Create it from scratch with the tests below.
Use `vi.doMock` + `vi.resetModules()` in `beforeEach` to isolate sandbox mocking
(same pattern as `shell.test.ts`).

```typescript
import { describe, expect, it, vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('code-exec tool', () => {
  it('executes javascript and returns stdout on success', async () => {
    vi.doMock('./sandbox.js', () => ({
      runCodeInSandbox: vi.fn().mockResolvedValue({
        stdout: '42',
        stderr: '',
        exitCode: 0,
      }),
    }));
    const { codeExecTool } = await import('./code.js');
    const result = await codeExecTool.execute({ code: '6 * 7', language: 'javascript' }) as {
      output: string;
      error: null;
      exitCode: number;
    };
    expect(result.output).toBe('42');
    expect(result.error).toBeNull();
    expect(result.exitCode).toBe(0);
  });

  it('returns error field and null output on non-zero exit', async () => {
    vi.doMock('./sandbox.js', () => ({
      runCodeInSandbox: vi.fn().mockResolvedValue({
        stdout: '',
        stderr: 'NameError: name x is not defined',
        exitCode: 1,
      }),
    }));
    const { codeExecTool } = await import('./code.js');
    const result = await codeExecTool.execute({ code: 'print(x)', language: 'python' }) as {
      output: null;
      error: string;
      exitCode: number;
    };
    expect(result.output).toBeNull();
    expect(result.error).toContain('NameError');
    expect(result.exitCode).toBe(1);
  });

  it('auto-detects python from print( keyword', async () => {
    const runCodeInSandbox = vi.fn().mockResolvedValue({ stdout: 'hi', stderr: '', exitCode: 0 });
    vi.doMock('./sandbox.js', () => ({ runCodeInSandbox }));
    const { codeExecTool } = await import('./code.js');
    await codeExecTool.execute({ code: 'print("hi")' });
    expect(runCodeInSandbox).toHaveBeenCalledWith(
      'print("hi")',
      'python',
      expect.any(Object),
    );
  });

  it('auto-detects javascript when no python keywords found', async () => {
    const runCodeInSandbox = vi.fn().mockResolvedValue({ stdout: '2', stderr: '', exitCode: 0 });
    vi.doMock('./sandbox.js', () => ({ runCodeInSandbox }));
    const { codeExecTool } = await import('./code.js');
    await codeExecTool.execute({ code: '1 + 1' });
    expect(runCodeInSandbox).toHaveBeenCalledWith(
      '1 + 1',
      'javascript',
      expect.any(Object),
    );
  });

  it('needsConfirmation is true when code contains import', () => {
    // needsConfirmation is synchronous - no async needed
    const { codeExecTool } = require('./code.js') as typeof import('./code.js');
    expect(codeExecTool.needsConfirmation?.({ code: "import fs from 'fs'" })).toBe(true);
  });

  it('needsConfirmation is false for plain arithmetic', () => {
    const { codeExecTool } = require('./code.js') as typeof import('./code.js');
    expect(codeExecTool.needsConfirmation?.({ code: '2 + 2' })).toBe(false);
  });

  it('is marked dangerous', async () => {
    const { codeExecTool } = await import('./code.js');
    expect(codeExecTool.dangerous).toBe(true);
  });

  it('includes executionTime in the result', async () => {
    vi.doMock('./sandbox.js', () => ({
      runCodeInSandbox: vi.fn().mockResolvedValue({ stdout: 'ok', stderr: '', exitCode: 0 }),
    }));
    const { codeExecTool } = await import('./code.js');
    const result = await codeExecTool.execute({ code: '"ok"' }) as { executionTime: number };
    expect(typeof result.executionTime).toBe('number');
    expect(result.executionTime).toBeGreaterThanOrEqual(0);
  });
});

describe('runCodeInSandbox Python fallback', () => {
  it('returns clear error for Python when Docker is unavailable', async () => {
    vi.doMock('./sandbox.js', async (importOriginal) => {
      const actual = await importOriginal<typeof import('./sandbox.js')>();
      return {
        ...actual,
        checkDocker: vi.fn().mockResolvedValue(false),
        isDockerAvailable: vi.fn().mockReturnValue(false),
      };
    });
    const { runCodeInSandbox } = await import('./sandbox.js');
    const result = await runCodeInSandbox('print("hi")', 'python', {
      timeout: 5000,
      memoryMb: 128,
      networkDisabled: true,
    });
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Docker');
    expect(result.stdout).toBe('');
  });

  it('falls back to vm for JavaScript when Docker is unavailable', async () => {
    vi.doMock('./sandbox.js', async (importOriginal) => {
      const actual = await importOriginal<typeof import('./sandbox.js')>();
      return {
        ...actual,
        checkDocker: vi.fn().mockResolvedValue(false),
        isDockerAvailable: vi.fn().mockReturnValue(false),
      };
    });
    const { runCodeInSandbox } = await import('./sandbox.js');
    const result = await runCodeInSandbox('1 + 1', 'javascript', {
      timeout: 5000,
      memoryMb: 128,
      networkDisabled: true,
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('2');
  });
});
```

**Note on the `needsConfirmation` tests**: those two tests use `require()` because
`needsConfirmation` is a synchronous property. If TypeScript complains, convert
them to `await import(...)` and call the function directly - the key assertion is
that the return value is `true` for `import` and `false` for plain code.

---

## What NOT to change

- Do not change `runDirectShell`, `runInSandbox`, `runJsVmFallback`, `checkDocker`,
  `initSandbox`, or `isDockerAvailable` in `sandbox.ts`.
- Do not change anything in `code.ts` except the `description` string.
- Do not change `shell.test.ts` or any existing test file.
- Do not add new parameters to `codeExecTool`.
- Do not change `dangerous: true` or `needsConfirmation` logic in `code.ts`.

---

## General rules

- TypeScript only. No `any` unless unavoidable.
- No em dashes, no emojis anywhere.
- Run `npx tsc --noEmit` after changes and fix all TypeScript errors before moving on.
- Do not touch files not listed in this prompt.

---

## Verification checklist

- [ ] `npx tsc --noEmit` exits 0
- [ ] `npx vitest run src/tools/code.test.ts` - all pass (8 tool tests + 2 sandbox tests = 10)
- [ ] Regression: `npx vitest run src/tools/shell.test.ts src/tools/file.test.ts src/tools/patch.test.ts src/tools/search-files.test.ts src/tools/process.test.ts src/tools/delegate-task.test.ts` - all pass
- [ ] In `sandbox.ts`, `runCodeInSandbox` returns `exitCode: 1` with a message containing "Docker" when `language === 'python'` and Docker is unavailable
- [ ] JS vm fallback still works when Docker is unavailable
- [ ] Description updated in `codeExecTool`
