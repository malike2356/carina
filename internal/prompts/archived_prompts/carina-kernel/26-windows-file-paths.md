# Carina Kernel: Fix hardcoded Unix file paths

## Goal

Replace every hardcoded Unix-style path (`/tmp/...`, hardcoded `/` separators, and
`/proc/...` references) with cross-platform equivalents from Node.js `os` and `path`
modules. After this change, Carina's file tools work on Windows without WSL.

## Context

Windows uses `C:\Users\...` style paths and `\` as separator. Any code that hardcodes
`/tmp` as a working directory will fail on Windows with `ENOENT` because that path does
not exist. Node.js provides `os.tmpdir()` which returns the correct temp directory on
every platform (`/tmp` on Linux, `C:\Users\<user>\AppData\Local\Temp` on Windows).

Similarly, `path.join()` uses the correct separator for the current OS. Hardcoded `/`
separators work on Linux but produce wrong results on Windows.

This is a grep-and-fix task. No new logic is introduced; only platform-specific strings
are replaced with Node.js built-ins.

## Dependencies

None. Run before or after prompt 25 (order does not matter).

## Files to search and modify

Run this search to find every file that needs fixing:

```bash
cd core.carinaai.uk

# Hardcoded /tmp paths
grep -rn '"/tmp' src/ --include="*.ts" -l
grep -rn "'/tmp" src/ --include="*.ts" -l
grep -rn '`/tmp' src/ --include="*.ts" -l

# Hardcoded path separators (look for string literals like '/file', '/dir')
grep -rn "'\//\|\"/" src/ --include="*.ts" | grep -v "http\|https\|url\|URL" -l

# /proc references (Linux-only process info filesystem)
grep -rn '/proc/' src/ --include="*.ts" -l
```

## Step-by-step

### 1. Fix /tmp references

For each occurrence of `/tmp` in source files, replace with `os.tmpdir()`:

Before:
```typescript
const workDir = '/tmp/carina-sandbox';
const outputFile = `/tmp/carina-output-${sessionId}.txt`;
```

After:
```typescript
import { tmpdir } from 'os';
import { join } from 'path';

const workDir = join(tmpdir(), 'carina-sandbox');
const outputFile = join(tmpdir(), `carina-output-${sessionId}.txt`);
```

Pattern for the replacement:
- `/tmp/carina-...` becomes `join(tmpdir(), 'carina-...')`
- `'/tmp'` alone becomes `tmpdir()`
- Template literals `` `/tmp/${variable}` `` become `join(tmpdir(), variable)`

### 2. Fix hardcoded path separators

Before:
```typescript
const configPath = `${homeDir}/.carina/config.json`;
const pluginPath = pluginDir + '/' + pluginName;
```

After:
```typescript
import { join } from 'path';

const configPath = join(homeDir, '.carina', 'config.json');
const pluginPath = join(pluginDir, pluginName);
```

Exception: do NOT change URL paths (`https://example.com/api/v1`), import paths
(`import './module.js'`), or regex patterns. Only fix filesystem paths.

### 3. Fix os.homedir() usage

If the code uses hardcoded `/home/` or `~`:

Before:
```typescript
const configDir = `/home/${process.env.USER}/.carina`;
const configDir = '~/.carina';
```

After:
```typescript
import { homedir } from 'os';
import { join } from 'path';

const configDir = join(homedir(), '.carina');
```

### 4. Fix /proc references (process info)

`/proc/` is a Linux-only virtual filesystem. If Carina reads `/proc/cpuinfo`,
`/proc/meminfo`, or `/proc/<pid>/status`, these do not exist on Windows.

Find all occurrences:
```bash
grep -rn '/proc/' src/ --include="*.ts"
```

For each one, replace with the Node.js `os` module equivalent:

| Linux /proc equivalent | Node.js replacement |
|---|---|
| `/proc/cpuinfo` (CPU count) | `os.cpus().length` |
| `/proc/meminfo` (total RAM) | `os.totalmem()` |
| `/proc/meminfo` (free RAM) | `os.freemem()` |
| `/proc/<pid>/status` (process alive check) | `process.kill(pid, 0)` returns without throwing if alive |
| Platform check (`uname`) | `os.platform()` |

Example:
```typescript
// Before (Linux only)
const cpuCount = parseInt(fs.readFileSync('/proc/cpuinfo', 'utf8').match(/processor\s+:/g)?.length.toString() ?? '1');

// After (cross-platform)
import { cpus } from 'os';
const cpuCount = cpus().length;
```

### 5. Fix path separator in glob patterns

If Carina uses glob patterns with hardcoded `/`:

Before:
```typescript
const pattern = `${projectDir}/src/**/*.ts`;
```

After:
```typescript
import { join } from 'path';
// glob libraries accept forward slashes on all platforms; use them consistently
const pattern = join(projectDir, 'src', '**', '*.ts').replace(/\\/g, '/');
```

Note: most glob libraries (`fast-glob`, `globby`) accept forward slashes on Windows.
The `replace` call normalises Windows backslashes to forward slashes for glob consumption.

### 6. Create a central path helper

If many files need `tmpdir()` and `homedir()`, consolidate into
`src/lib/platform-paths.ts` to avoid scattered imports:

```typescript
import { tmpdir as osTmpdir, homedir as osHomedir } from 'os';
import { join } from 'path';

export const CARINA_TEMP_DIR = join(osTmpdir(), 'carina');
export const CARINA_CONFIG_DIR = join(osHomedir(), '.carina');
export const CARINA_LOGS_DIR = join(osHomedir(), '.carina', 'logs');
export const CARINA_MEMORY_DIR = join(osHomedir(), '.carina', 'memory');

export function tempFile(name: string): string {
  return join(CARINA_TEMP_DIR, name);
}
```

Then replace scattered `join(tmpdir(), 'carina', ...)` calls with:
```typescript
import { CARINA_TEMP_DIR, tempFile } from '../lib/platform-paths.js';
```

### 7. Ensure temp dir is created at startup

Windows does not auto-create `os.tmpdir()/carina`. Add to the Carina startup sequence:

```typescript
import { mkdirSync } from 'fs';
import { CARINA_TEMP_DIR, CARINA_CONFIG_DIR } from './lib/platform-paths.js';

mkdirSync(CARINA_TEMP_DIR, { recursive: true });
mkdirSync(CARINA_CONFIG_DIR, { recursive: true });
```

`{ recursive: true }` is idempotent: it does not throw if the directory already exists.

## Test

Add `src/lib/platform-paths.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { CARINA_TEMP_DIR, CARINA_CONFIG_DIR, tempFile } from './platform-paths.js';
import { existsSync } from 'fs';
import { platform } from 'os';

describe('platform-paths', () => {
  it('CARINA_TEMP_DIR does not contain hardcoded /tmp', () => {
    // On Windows this should point into AppData\Local\Temp, not /tmp
    if (platform() === 'win32') {
      expect(CARINA_TEMP_DIR).not.toContain('/tmp');
      expect(CARINA_TEMP_DIR.toLowerCase()).toContain('temp');
    } else {
      expect(CARINA_TEMP_DIR).toContain('carina');
    }
  });

  it('tempFile returns a path inside CARINA_TEMP_DIR', () => {
    const p = tempFile('output.txt');
    expect(p).toContain('carina');
    expect(p).toContain('output.txt');
  });

  it('CARINA_CONFIG_DIR is under the home directory', () => {
    const { homedir } = require('os');
    expect(CARINA_CONFIG_DIR.startsWith(homedir())).toBe(true);
  });
});
```

## Expected behavior

On Linux: `CARINA_TEMP_DIR` = `/tmp/carina`
On Windows: `CARINA_TEMP_DIR` = `C:\Users\<user>\AppData\Local\Temp\carina`
On macOS: `CARINA_TEMP_DIR` = `/var/folders/.../carina`

All file tool operations that previously wrote to `/tmp` now write to the correct
platform-specific temp directory.

## Pitfalls

- Do not change import paths (`from './utils.js'`) - these use `/` as a module separator
  and must stay as-is regardless of OS
- Do not change HTTP URL paths (`https://api.example.com/v1/`) - these are URLs not
  filesystem paths
- After the fix, run `pnpm test` on the Linux CI and check no tests regressed; the
  `os.tmpdir()` value on Linux is still `/tmp` so tests that rely on `/tmp` being in
  the path will still pass
- `path.join()` on Windows returns backslash-separated paths. If any code does string
  comparison like `if (p.includes('/tmp'))` it will break on Windows even after the fix.
  Replace string comparisons with `p.startsWith(CARINA_TEMP_DIR)` which uses the
  correct separator for the current OS
