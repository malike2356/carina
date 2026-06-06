# Code Execution

Executes JavaScript or Python in an isolated environment.

## Requirements

- **Docker** (preferred): full sandbox, no network, 128 MB RAM, 5 s timeout.
- **Fallback**: JavaScript only via Node `vm` when Docker is missing (no `import`/`require`/`process` in sandboxed path).

## Security

- Network disabled in Docker mode.
- Confirmation when source contains `import`, `require`, or `process`.
- Python requires Docker; there is no VM fallback for Python.
- Scout may block via `SCOUT_BLOCKLIST`.

## Language detection

If `language` is omitted, Carina infers from syntax (`def`, `import` -> Python; otherwise JavaScript).

## Example

> "Run this JavaScript: console.log([1,2,3].reduce((a,b)=>a+b,0))"

## Returns

```json
{
  "output": "6",
  "error": null,
  "exitCode": 0,
  "executionTime": 42
}
```

Non-zero exit codes populate `error` with stderr.
