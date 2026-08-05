# Carina Kernel: Add Windows CI runner

## Goal

Add a GitHub Actions workflow that runs the Carina test suite on Windows so regressions
are caught before they reach users. The Windows runner runs in parallel with the existing
Linux runner; a failing Windows test blocks the merge.

## Context

After the Windows compatibility fixes (prompts 25-29), the tests must pass on Windows to
prove the fixes work. Without a Windows CI runner, a Windows regression can ship silently
because the Linux runner still passes.

GitHub Actions provides `windows-latest` runners (Windows Server 2022 with PowerShell,
Node.js, pnpm, Git, and Docker Desktop available). These are free for public repositories.

## Dependencies

Prompts 25-29 (all Windows fixes). Run this prompt last so the workflow tests the completed
Windows support, not partial fixes.

## Files to create/modify

```
.github/workflows/ci.yml           (create or modify existing)
```

## Step-by-step

### 1. Check for existing CI workflow

```bash
ls .github/workflows/
```

If `ci.yml` already exists, read it first and extend it. Do not overwrite.
If it does not exist, create the full file below.

### 2. Create the CI workflow

`.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test-linux:
    name: Test on Linux
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Install pnpm
        uses: pnpm/action-setup@v3
        with:
          version: 9

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'pnpm'
          cache-dependency-path: core.carinaai.uk/pnpm-lock.yaml

      - name: Install dependencies
        working-directory: core.carinaai.uk
        run: pnpm install --frozen-lockfile

      - name: Build
        working-directory: core.carinaai.uk
        run: pnpm build

      - name: Run tests
        working-directory: core.carinaai.uk
        run: pnpm test
        env:
          NODE_ENV: test

      - name: Upload test results
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: test-results-linux
          path: core.carinaai.uk/test-results/

  test-windows:
    name: Test on Windows
    runs-on: windows-latest

    steps:
      - uses: actions/checkout@v4

      - name: Install pnpm
        uses: pnpm/action-setup@v3
        with:
          version: 9

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'pnpm'
          cache-dependency-path: core.carinaai.uk/pnpm-lock.yaml

      - name: Install dependencies
        working-directory: core.carinaai.uk
        # frozen-lockfile ensures the same packages as Linux
        run: pnpm install --frozen-lockfile

      - name: Rebuild native modules for Windows
        working-directory: core.carinaai.uk
        # node-pty and other native addons need rebuilding
        run: pnpm rebuild

      - name: Build
        working-directory: core.carinaai.uk
        run: pnpm build

      - name: Run tests
        working-directory: core.carinaai.uk
        run: pnpm test
        env:
          NODE_ENV: test
          # Tell tests that run platform-specific branches to use Windows paths
          FORCE_PLATFORM: win32

      - name: Upload test results
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: test-results-windows
          path: core.carinaai.uk/test-results/

  test-macos:
    name: Test on macOS
    runs-on: macos-latest

    steps:
      - uses: actions/checkout@v4

      - name: Install pnpm
        uses: pnpm/action-setup@v3
        with:
          version: 9

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'pnpm'
          cache-dependency-path: core.carinaai.uk/pnpm-lock.yaml

      - name: Install dependencies
        working-directory: core.carinaai.uk
        run: pnpm install --frozen-lockfile

      - name: Build
        working-directory: core.carinaai.uk
        run: pnpm build

      - name: Run tests
        working-directory: core.carinaai.uk
        run: pnpm test
        env:
          NODE_ENV: test
```

### 3. Make platform-specific tests conditional

Some tests only make sense on specific platforms. Use Vitest's `describe.runIf`:

In any test file that tests platform-specific behaviour:
```typescript
import { platform } from 'os';

describe.runIf(platform() === 'win32')('Windows-specific: shell uses PowerShell', () => {
  it('getPlatformShell returns pwsh.exe or powershell.exe', () => {
    const shell = getPlatformShell();
    expect(['pwsh.exe', 'powershell.exe']).toContain(shell.command);
  });
});

describe.runIf(platform() !== 'win32')('Unix-specific: shell uses bash', () => {
  it('getPlatformShell returns /bin/bash', () => {
    const shell = getPlatformShell();
    expect(shell.command).toBe('/bin/bash');
  });
});
```

The `FORCE_PLATFORM` env var set in the workflow can be used to test cross-platform code
paths on the wrong OS for edge-case coverage:

```typescript
export function getPlatformShell(): ShellDescriptor {
  const os = process.env.FORCE_PLATFORM ?? platform();
  if (os === 'win32') {
    return { command: 'pwsh.exe', args: (cmd) => ['-NoProfile', '-NonInteractive', '-Command', cmd], lineSeparator: '\r\n' };
  }
  return { command: '/bin/bash', args: (cmd) => ['-c', cmd], lineSeparator: '\n' };
}
```

### 4. Add shell integration tests to Windows CI

```yaml
# Add to the test-windows job, after "Run tests":

      - name: Run shell integration tests (Windows)
        working-directory: core.carinaai.uk
        run: pnpm vitest run src/tools/shell-exec.windows.test.ts
        env:
          RUN_SHELL_INTEGRATION: 'true'
        continue-on-error: false
```

### 5. Handle pnpm-lock.yaml differences

The same `pnpm-lock.yaml` must work on all platforms. This is already the case unless
a package has OS-specific optional dependencies in its `package.json`. Confirm:

```bash
# In the repository root (or core.carinaai.uk/)
grep -r '"os"' node_modules/node-pty/package.json
```

`node-pty` has prebuilt binaries for each platform bundled in `optionalDependencies`.
pnpm installs only the correct platform's binaries. The lockfile includes all of them;
only the current platform's binaries are extracted. This is correct behaviour.

### 6. Add status badge to README

After the workflow is created and at least one run completes:

Add to `core.carinaai.uk/README.md`:
```markdown
[![CI Linux](https://github.com/<org>/Carina-ai/actions/workflows/ci.yml/badge.svg?job=test-linux)](https://github.com/<org>/Carina-ai/actions/workflows/ci.yml)
[![CI Windows](https://github.com/<org>/Carina-ai/actions/workflows/ci.yml/badge.svg?job=test-windows)](https://github.com/<org>/Carina-ai/actions/workflows/ci.yml)
[![CI macOS](https://github.com/<org>/Carina-ai/actions/workflows/ci.yml/badge.svg?job=test-macos)](https://github.com/<org>/Carina-ai/actions/workflows/ci.yml)
```

Replace `<org>` with the actual GitHub organisation or username.

## Expected behavior

On every PR and push to `main`:
1. Three parallel jobs start: Linux, Windows, macOS
2. All three must pass for the PR to be mergeable (if branch protection is enabled)
3. Failure output shows which platform failed and what the test error was
4. Artifacts include test result files for debugging

GitHub Actions `windows-latest` runtime details:
- Windows Server 2022
- PowerShell 5.1 and PowerShell Core 7.x (`pwsh`)
- Node.js available via `actions/setup-node`
- Visual C++ Build Tools (needed for native `.node` compilation)
- pnpm via `pnpm/action-setup`

## Pitfalls

- The `windows-latest` runner uses Windows line endings by default in `git checkout`.
  Ensure `.gitattributes` is present with `* text=auto` or the source files will have
  CRLF endings that break the TypeScript compiler in some configurations
- Native modules (`.node` files like `node-pty`) must be compiled for the target
  platform. `pnpm rebuild` in the CI script handles this. If a test fails with
  `MODULE_NOT_FOUND` for a native module, the rebuild step did not run or failed silently
- GitHub Actions Windows runners are ~50% slower than Linux runners for the same job.
  If test suite time becomes a problem, use `--shard` to split tests across runners
- The `working-directory` context must be set for every step. Commands run from the
  repo root by default, not `core.carinaai.uk/`
- `pnpm install --frozen-lockfile` will fail if `pnpm-lock.yaml` is out of date relative
  to `package.json`. Fix by running `pnpm install` locally and committing the updated
  lockfile before pushing
