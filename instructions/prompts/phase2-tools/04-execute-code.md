# Phase 2.4; execute_code Tool

## Task
Implement the `execute_code` tool. This allows Carina to run Python scripts that can call other tools programmatically; enabling loops, conditionals, batching, and retry logic.

## Specification

### What it does
Runs a Python script in the session's working directory. The script can import and call other Carina tools as functions. This is the bridge between "one tool call at a time" and "programmatic tool orchestration."

### Available imports
```python
from hermes_tools import read_file, write_file, search_files, patch, terminal
```

Each tool function mirrors the tool specification:
- read_file(path, offset=1, limit=500) -> dict
- write_file(path, content) -> dict
- search_files(pattern, target="content", path=".", file_glob=None, limit=50) -> dict
- patch(path, old_string, new_string, replace_all=False) -> dict
- terminal(command, timeout=None, workdir=None) -> dict

### Built-in helpers (no import needed)
- json_parse(text): json.loads with strict=False (for parsing tool outputs with control chars)
- shell_quote(s): shlex.quote() (for safe shell command building)
- retry(fn, max_attempts=3, delay=2): retry with exponential backoff

### Limits
- 5-minute timeout
- 50KB stdout cap
- Max 50 tool calls per script
- terminal() is foreground-only (no background or PTY)

### Use cases
- Loop: fetch 50 pages, process 10,000 files, batch API calls
- Conditional: if X then Y else Z
- Filter: reduce large tool outputs before they enter context
- Retry: handle transient failures automatically

### Implementation notes
- Script runs in a sandboxed Python subprocess
- Tool calls are serialized: script -> tool -> result -> script
- Working directory matches the session
- Active venv's python is used (so project deps like pandas work)
- Print final result to stdout for capture

### Verification
```python
# Batch file processing
from hermes_tools import search_files, read_file
files = search_files("*.log", target="files", path="/var/log", limit=10)
for f in files["matches"]:
    content = read_file(f, limit=5)
    print(f"{f}: {content['content'][:100]}")

# Conditional branching  
from hermes_tools import terminal
result = terminal("which docker")
if result["exit_code"] == 0:
    print("Docker installed:", result["output"].strip())
else:
    print("Docker not found")
```
