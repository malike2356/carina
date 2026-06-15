# Cursor Task: Fix and improve file tools (#11-14) in Carina

## Context

Carina is a Node.js/TypeScript autonomous AI agent at:
`/opt/lampp/htdocs/verlox/carina/core.carinaai.uk/`

We are hardening the 27 Hermes tools one by one. Tools #10 (terminal) and #18-21
(memory, todo, clarify, session-search) are confirmed working. This task covers:

- `file-read` (tool #11) - `src/tools/file.ts` - `fileReadTool`
- `file-write` (tool #12) - `src/tools/file.ts` - `fileWriteTool`
- `patch` (tool #13) - `src/tools/patch.ts` - `patchTool`
- `search-files` (tool #14) - `src/tools/search-files.ts` - `searchFilesTool`

Read these files in full before touching anything:
- `src/tools/file.ts`
- `src/tools/patch.ts`
- `src/tools/search-files.ts`
- `src/tools/file-syntax.ts`
- `src/tools/path-utils.ts`
- `src/tools/file.test.ts`
- `src/tools/patch.test.ts`
- `src/tools/search-files.test.ts`

Do NOT modify any file you have not read first.
Do NOT touch `src/tools/file-syntax.ts` or `src/tools/path-utils.ts` (read only).

---

## Bug #1: search-files treats zero results as an error (search-files.ts)

`execFileAsync` throws when the child process exits with a non-zero code. Both
ripgrep and grep use exit code 1 to signal "no matches found" (not a failure),
and exit code 2 to signal an actual error. The current code catches all throws
and returns `{ error: 'search failed: ...' }`, so a valid search with zero
matches looks like a broken tool to the agent.

### Fix in `searchWithRipgrep`:

Replace:
```typescript
const { stdout } = await execFileAsync('rg', args, { maxBuffer: 2 * 1024 * 1024 });
```

With a pattern that catches exit-1 (no matches) and treats it as empty results:

```typescript
let stdout = '';
try {
  const out = await execFileAsync('rg', args, { maxBuffer: 2 * 1024 * 1024 });
  stdout = out.stdout;
} catch (err: unknown) {
  const e = err as { code?: number; stdout?: string };
  if (e.code === 1) {
    stdout = e.stdout ?? '';
  } else {
    throw err;
  }
}
```

### Fix in `searchWithGrep`:

Apply the same pattern to `execFileAsync('grep', ...)` - grep also exits 1 for
no matches and 2 for errors. Same code shape as above but for grep.

---

## Improvement #1: file-read description (file.ts)

Replace the current `fileReadTool` description with:

```
'Read file contents with line numbers. Returns { content, total_lines, offset, limit, truncated }. When truncated is true, call again with offset set to the next unread line to continue. Supports offset/limit pagination - use offset (1-based) and limit to read specific ranges of large files. Blocks /etc, /proc, /sys, and path traversal.'
```

---

## Improvement #2: patch description (patch.ts)

Replace the current `patchTool` description with:

```
'Apply a find-and-replace edit to a file. old_string must match exactly one location - if it matches multiple, use replace_all=true or make old_string longer and more unique. Tries exact match first, then fuzzy variants (CRLF normalisation, tab-to-spaces, whitespace trim). Returns a diff and flags any new syntax errors introduced. Cannot create new files - use file-write for that.'
```

---

## Improvement #3: search-files description (search-files.ts)

Replace the current `searchFilesTool` description with:

```
'Search file contents or filenames. pattern is a regex. target=content (default) searches inside files; target=files lists paths that match file_glob. output_mode: content returns matching lines with line numbers, files_only returns paths only, count returns a per-file count. Uses ripgrep if installed, falls back to grep, then a Node.js walk. Returns { results, count, engine }. Zero matches returns count=0, not an error.'
```

---

## Tests to ADD (do not remove any existing tests)

### In `src/tools/search-files.test.ts`

**Test: zero matches returns empty results, not an error**

```typescript
it('returns empty results when pattern matches nothing', async () => {
  await setup();
  const result = await searchFilesTool.execute({
    pattern: 'THIS_PATTERN_WILL_NEVER_MATCH_XYZ_987',
    path: tmpDir,
  }) as Record<string, unknown>;

  expect(result.error).toBeUndefined();
  expect(result.count).toBe(0);
  expect(Array.isArray(result.results)).toBe(true);
});
```

**Test: target=files lists matching paths**

```typescript
it('target=files lists paths matching file_glob', async () => {
  await setup();
  const result = await searchFilesTool.execute({
    pattern: '*.ts',
    path: tmpDir,
    target: 'files',
    file_glob: '*.ts',
  }) as Record<string, unknown>;

  expect(result.error).toBeUndefined();
  expect(Number(result.count)).toBeGreaterThan(0);
  const results = result.results as string[];
  expect(results.every((r) => r.endsWith('.ts'))).toBe(true);
});
```

**Test: node-walk fallback when neither rg nor grep available**

```typescript
it('falls back to node-walk when rg and grep are unavailable', async () => {
  await setup();
  vi.doMock('child_process', async (importOriginal) => {
    const actual = await importOriginal<typeof import('child_process')>();
    return {
      ...actual,
      execFile: vi.fn((_cmd: string, _args: unknown[], _opts: unknown, cb: Function) => {
        cb(new Error('not found'));
      }),
    };
  });
  vi.resetModules();
  const { searchFilesTool: tool } = await import('./search-files.js');
  const result = await tool.execute({ pattern: 'alpha', path: tmpDir }) as Record<string, unknown>;
  expect(result.engine).toBe('node-walk');
  expect(Number(result.count)).toBeGreaterThan(0);
});
```

### In `src/tools/patch.test.ts`

**Test: returns error when file does not exist**

```typescript
it('returns error when file does not exist', async () => {
  const result = await patchTool.execute({
    path: '/tmp/__carina_no_such_file_xyz__.txt',
    old_string: 'anything',
    new_string: 'replacement',
  }) as Record<string, unknown>;

  expect(result.error).toContain('not found');
});
```

**Test: returns error when old_string not found in file**

```typescript
it('returns error when old_string not found in file', async () => {
  await setup();
  const file = path.join(tmpDir, 'target.txt');
  await fs.writeFile(file, 'hello world');

  const result = await patchTool.execute({
    path: file,
    old_string: 'this text does not exist',
    new_string: 'anything',
  }) as Record<string, unknown>;

  expect(result.error).toContain('not found');
});
```

**Test: blocks writes to /etc**

```typescript
it('blocks patch to blocked system paths', async () => {
  const result = await patchTool.execute({
    path: '/etc/hosts',
    old_string: 'localhost',
    new_string: 'hacked',
  }) as Record<string, unknown>;

  expect(result.error).toContain('cannot patch');
});
```

---

## What NOT to change

- Do not change `file-syntax.ts` or `path-utils.ts`.
- Do not change `dangerous: true` or `requiresConfirmation: true` on `fileWriteTool`
  or `patchTool`.
- Do not change the `needsConfirmation` logic on either tool.
- Do not change the honeypot integration in `fileReadTool`.
- Do not remove any existing tests.
- Do not change `levenshteinDistance` or `suggestSimilarFiles` in `file.ts`.
- Do not add any new parameters to any of the four tools.

---

## General rules

- TypeScript only. No `any` unless unavoidable (document why with a comment).
- No em dashes, no emojis anywhere.
- Functions under 20 lines.
- Run `npx tsc --noEmit` after every file change and fix all errors before moving on.
- Run tests after all changes.
- Do not touch files not listed in this prompt unless a TypeScript error requires it.

---

## Verification checklist

- [ ] `npx tsc --noEmit` exits 0
- [ ] `npx vitest run src/tools/file.test.ts` - all pass (14 existing unchanged)
- [ ] `npx vitest run src/tools/patch.test.ts` - all pass (4 existing + 3 new = 7)
- [ ] `npx vitest run src/tools/search-files.test.ts` - all pass (3 existing + 3 new = 6)
- [ ] Regression: `npx vitest run src/tools/memory.test.ts src/tools/todo.test.ts src/tools/clarify.test.ts src/tools/session-search.test.ts src/tools/shell.test.ts` - all pass
- [ ] In `searchWithRipgrep`, exit code 1 returns `{ results: [], count: 0 }`, not `{ error: ... }`
- [ ] In `searchWithGrep`, exit code 1 returns `{ results: [], count: 0 }`, not `{ error: ... }`
- [ ] All three description strings are updated in their respective tool definitions
