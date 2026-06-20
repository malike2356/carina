# Action: File System Tools - Extend file-read/file-write, Build patch + search-files (Standalone Carina)

## Goal
Bring Carina's file tools up to the spec's bar: add line-numbered/paginated reads and syntax-check-on-write to the existing `file-read`/`file-write` tools, and build the two genuinely missing tools, `patch` (fuzzy find-and-replace) and `search-files` (ripgrep-backed search).

## Context
- Project: `core.carinaai.uk`. Node.js 22 + TypeScript 5, ESM imports, pnpm, Vitest.
- Two of the spec's four tools already exist: `fileReadTool`/`fileWriteTool` in `src/tools/file.ts` (96 lines, read in full). They are simpler than the spec describes (plain-text dump vs. line-numbered pagination, no syntax checking) but they already do the security-critical work correctly: `expandPath`/`isSafePath`/`isBlockedSystemWrite` from `src/tools/path-utils.ts`, honeypot checks via `checkHoneypotFilePath`, a `MAX_READ_BYTES` truncation guard, and `needsConfirmation` on overwrites. **Any new file tool must reuse these exact helpers - do not write a second path-validation routine.**
- `patch` and `search-files` do not exist (`grep -rln 'search_files\|search-files\|ripgrep\|"rg"\|fuzzy.*match\|patch-file' src/` returns nothing).
- Read `src/tools/path-utils.ts` (22 lines) fully before writing anything - it's small and is the single source of truth for "is this path allowed."
- Conventions: functions under ~20 lines, Tools return error objects/strings rather than throwing on expected failure modes (mirror `fileReadTool`'s `'Error: ...'` string returns and `propertyDataTool`'s `{ error: '...' }` object returns - check which shape the rest of `file.ts` already commits to and stay consistent within the file), Vitest mirroring `file.test.ts`, no em dashes/emojis.

## Files to modify
- `src/tools/file.ts` - extend `fileReadTool` (line numbers + pagination) and `fileWriteTool` (syntax checking)
- `src/tools/file.test.ts` - add coverage for the new behaviour
- `src/tools/index.ts` - register the two new tools

## Files to create
- `src/tools/patch.ts` - fuzzy find-and-replace tool
- `src/tools/patch.test.ts`
- `src/tools/search-files.ts` - ripgrep-backed content/filename search
- `src/tools/search-files.test.ts`

## Step-by-step

1. **Extend `fileReadTool`** to return `"LINE_NUM|CONTENT"` formatted output with `offset`/`limit` parameters (default `offset=1`, `limit=500`, hard cap `2000`):
   - This changes the tool's return shape from a plain string to `{ content: string, total_lines: number }` (or similar) - check whether anything currently depends on `file-read` returning a bare string (`grep -rn "fileReadTool\|'file-read'" src/` for callers) before changing the shape; if the agent loop just relays tool results to the LLM as text, a shape change is safe, but confirm rather than assume.
   - Implement pagination by reading the file once, splitting on `\n`, slicing `[offset-1, offset-1+limit]`, and prefixing each kept line with its 1-based line number and `|`.
   - Add the spec's "reads exceeding ~100K characters are rejected, use offset/limit" behaviour - this should compose naturally with the existing `MAX_READ_BYTES` truncation rather than duplicate it; decide whether truncation or rejection is the right response when `limit` would still produce >100K chars, and make the message tell the caller to retry with smaller `limit`/different `offset`.
   - Levenshtein-distance filename suggestions on "not found": write a small `levenshteinDistance(a, b): number` pure function (or check if a tiny dependency-free implementation already exists somewhere - do not add an npm dependency for this), list the directory, sort by distance, suggest the top 2-3 close matches in the error message.

2. **Extend `fileWriteTool`** to run syntax checks after writing `.py`/`.json`/`.yaml`/`.toml` files:
   - `.json`: `JSON.parse` the written content - trivial, no subprocess needed
   - `.py`: `python3 -m py_compile <path>` via the sandbox (`runInSandbox` or a direct `execFile` if running on the host file is required - py_compile needs to see the actual file, so this likely cannot run inside the network-isolated Docker sandbox if the file lives on the host filesystem; resolve this by checking whether `python3` is available on the host directly via `execFile`, mirroring `checkDocker`'s availability-probe pattern, and skipping the check gracefully with a one-line note if it's not)
   - `.yaml`/`.toml`: a lightweight parse-check; check `package.json` for an existing YAML/TOML parser before adding one (`grep -n '"yaml"\|"js-yaml"\|"toml"' package.json`) - if none exists, decide whether adding one for a "nice to have" syntax check is worth a new dependency, or whether skipping these two extensions (with a one-line note) is the more proportionate choice
   - **Critical constraint from the spec**: "Only NEW errors introduced by this write are surfaced" - this means you must run the check, and if it fails, you need to know whether the SAME error existed before the write (pre-existing broken file) or was introduced by this change. The simplest correct approach: read+check the file's prior content (if it existed) before overwriting, diff the error sets, and report only the new ones. Do not report pre-existing syntax errors as if this write caused them - that would mislead the agent into "fixing" something it didn't break.

3. **Build `patch.ts`** (`patchTool`, action name `patch` or `file-patch` - check the existing naming convention in `tools/index.ts`, e.g. `file-read`/`file-write` use hyphens, follow that):
   - Parameters: `path`, `old_string`, `new_string`, `replace_all` (default false)
   - Read the file via the same `expandPath`/`isSafePath` checks as `fileReadTool`
   - Exact match first; if not found or not unique (and `replace_all` is false), fall back to fuzzy matching. The spec asks for "9 fuzzy matching strategies" - that is almost certainly more than this codebase needs on day one. Build the 2-3 that handle the cases that actually bite in practice (leading/trailing whitespace differences, tab-vs-space indentation, line-ending differences CRLF/LF) as small composable normalisation functions, get it working and tested, and document in your completion summary which strategies you implemented and which you deliberately deferred - shipping 3 well-tested strategies beats shipping 9 untested ones.
   - Return a unified diff (check `package.json` for a diff library - `grep -n '"diff"\|"jsdiff"' package.json`; if none exists, a minimal line-based diff is sufter to write than to pull in a dependency for, but a proper unified-diff format needs care - use a small, well-known library if one is already a transitive dependency, otherwise write the minimal line-diff and label its output clearly as "changed lines" rather than claiming full unified-diff compliance)
   - Run the same syntax-check-after-edit logic from step 2 (factor it into a shared function both tools call - do not duplicate it)
   - Reject (return an error, don't throw) when `old_string` matches multiple locations and `replace_all` is false - the spec requires uniqueness in that case

4. **Build `search-files.ts`** (`searchFilesTool`):
   - Probe for `rg` (ripgrep) availability the same way `sandbox.ts` probes for Docker (`checkDocker` pattern: cache the result, `execFile('rg', ['--version'])`); fall back to `grep -r` when `rg` is missing, and to a Node.js `fs.readdir` + regex walk as the last resort for filename-glob search if even `grep` is unavailable
   - `target: 'content'`: shell out to `rg` with the pattern, `--line-number`, `--max-count`/`--context` mapped from `limit`/`context`, and `file_glob` mapped to `--glob`. Use `execFile` with an argument array - never interpolate the user-supplied `pattern` into a shell string (this is a search tool that takes regex from an LLM; a `pattern` like `'; rm -rf ~ #` must never reach a shell)
   - `target: 'files'`: `rg --files -g <glob>` or equivalent
   - `output_mode`: `content` (matching lines + line numbers), `files_only` (paths only), `count` (per-file match counts) - map each to the corresponding `rg` flags (`-c` for count, `-l` for files-only)
   - Respect `path` as the search root, validated through `isSafePath` so the LLM cannot point a recursive regex search at `/` or other sensitive trees
   - Cap results at `limit` (default 50) with `offset`-based pagination (note `rg` has no native offset - you may need to over-fetch and slice, or document that pagination beyond the first page re-runs the search; pick the simpler approach and say so)

5. Register both new tools in `src/tools/index.ts` alongside the existing file tools (no config-key gating needed - these have no external API dependency, just a binary-availability check at call time).

6. Write/extend the four test files (Vitest, mirror `file.test.ts`):
   - `file.test.ts`: line-numbered pagination at boundaries (offset past EOF, limit larger than file), Levenshtein suggestions on a near-miss filename, syntax-check catching a genuinely-new JSON error vs. tolerating a pre-existing one
   - `patch.test.ts`: exact match and replace, uniqueness rejection, each implemented fuzzy strategy against a deliberately-mismatched sample, `replace_all` behaviour, diff output shape
   - `search-files.test.ts`: mock `execFile` for `rg`/`grep`; test the fallback chain (rg available -> rg used; rg missing, grep available -> grep used; both missing -> Node fallback), test `pattern` is passed as an array argument never as a shell string, test each `output_mode`

## Expected behavior
- `file-read` returns line-numbered, paginated content and suggests close filename matches on a typo'd path.
- `file-write` flags genuinely-new syntax errors in `.py`/`.json` (and `.yaml`/`.toml` if you added support) without crying wolf about pre-existing breakage.
- `patch` makes precise, diff-visible edits and refuses ambiguous matches rather than guessing.
- `search-files` finds content and filenames quickly via `rg`, degrading gracefully through `grep` to a pure-Node walk when neither binary is present, with zero shell-injection surface.

## Test
```bash
cd core.carinaai.uk
pnpm vitest run src/tools/file.test.ts src/tools/patch.test.ts src/tools/search-files.test.ts
pnpm test
pnpm build
```

## Dependencies
- `ripgrep` (`rg`) recommended on the host/Docker image for `search-files` performance (document as an optional system dependency; the tool must work without it)
- `python3` on the host for `.py` syntax checks (probe and skip gracefully if absent)
- Possibly a small diff library if step 3's line-diff approach proves too crude in practice (only add one if a transitive dependency doesn't already provide it)
