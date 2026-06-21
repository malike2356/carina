# Phase 2.3; File System Tools (read_file, write_file, patch, search_files)

## Task
Implement the four file system tools: read_file, write_file, patch, search_files. These are the foundation tools; used by nearly every other tool and skill.

## read_file

### Specification
Read a text file with line numbers and pagination.

Parameters:
- path (string, required): Absolute or relative path
- offset (int, default 1): Line number to start from (1-indexed)
- limit (int, default 500, max 2000): Max lines to return

Returns:
- { content: "LINE_NUM|CONTENT", total_lines: N }

Features:
- Output format: "LINE_NUM|CONTENT" per line
- Suggests similar filenames if not found (Levenshtein distance)
- Reads exceeding ~100K characters are rejected; use offset and limit
- Cannot read images or binary files

Implementation: Use fs.readFileSync with UTF-8 encoding.

## write_file

### Specification
Write content to a file, completely replacing existing content.

Parameters:
- path (string, required): File path
- content (string, required): Complete content to write

Returns: { bytes_written: N, path: string }

Features:
- Creates parent directories automatically
- Auto-runs syntax checks on .py, .json, .yaml, .toml
- Only NEW errors introduced by this write are surfaced

Implementation: fs.mkdirSync for parents, fs.writeFileSync.

## patch

### Specification
Targeted find-and-replace edits with fuzzy matching.

Parameters:
- path (string, required): File to edit
- old_string (string, required): Text to find (must be unique unless replace_all)
- new_string (string, required): Replacement text
- replace_all (bool, default false): Replace all occurrences

Returns: unified diff of changes

Features:
- 9 fuzzy matching strategies (handles whitespace/indentation differences)
- Returns diff showing exactly what changed
- Auto-runs syntax checks after editing

Implementation: Find old_string in file content using fuzzy matching, replace with new_string.

## search_files

### Specification
Search file contents (regex) or find files by name (glob). Ripgrep-backed.

Parameters:
- pattern (string, required): Regex for content search, glob for file search
- target (enum: content|files, default content)
- path (string, default current dir): Directory to search
- file_glob (string, optional): Filter files by pattern
- limit (int, default 50): Max results
- offset (int, default 0): Skip first N results for pagination
- output_mode (enum: content|files_only|count): Output format
- context (int, default 0): Lines of context before/after matches

Returns:
- content mode: matching lines with line numbers
- files_only mode: list of file paths
- count mode: match counts per file

Implementation: Use ripgrep (rg) command line. Fall back to grep if ripgrep unavailable.

## Verification
```bash
# read_file
read_file: { path: "/etc/hosts", limit: 5 }

# write_file
write_file: { path: "/tmp/test.txt", content: "hello" }

# patch
patch: { path: "/tmp/test.txt", old_string: "hello", new_string: "world" }

# search_files (content)
search_files: { pattern: "TODO", target: "content", path: "./src" }

# search_files (files)
search_files: { pattern: "*.php", target: "files" }
```

## All four tools must
- Work with absolute and relative paths
- Handle errors gracefully (file not found, permission denied)
- Log to Scout audit trail
- Respect workspace boundaries (no escaping project root)
