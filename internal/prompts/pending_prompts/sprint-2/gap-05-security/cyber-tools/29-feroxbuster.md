# Tool: feroxbuster | #29 | Recursive Content Discovery


## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`

## Metadata
- **Priority:** HIGH; **Source:** Kali; **Binary:** `feroxbuster`; **Package:** `feroxbuster`
- **Risk:** medium; **Approval:** no; **OS:** kali, parrot, any (Rust binary)

## Purpose
Rust-based recursive content discovery tool. Fast, memory-efficient, with built-in recursion, filtering, and reporting. Feroxbuster excels at deep recursive scanning where gobuster/ffuf would struggle with state management.

## Carina CLI Command
```
carina fuzz dirs <url> --engine feroxbuster [--depth N] [--extensions php,js]
```

## TypeScript Wrapper

```typescript
export const feroxbusterTool: ToolDefinition = {
  name: 'feroxbuster_scan',
  description: 'Rust-based recursive content discovery; fast, deep recursion, filtering.',
  parameters: {
    url: { type: 'string', required: true },
    depth: { type: 'number', default: 3 },
    extensions: { type: 'array', items: 'string', default: ['php','html','js','txt'] },
    threads: { type: 'number', default: 50 },
    wordlist: { type: 'string' },
    filterStatus: { type: 'array', items: 'number' },
  },
  requires: ['feroxbuster'],
  risk: 'medium',
  category: 'web',
  handler: async (params, ctx) => {
    const wl = params.wordlist || '/usr/share/seclists/Discovery/Web-Content/raft-medium-directories.txt';
    const extFlag = params.extensions ? `-x ${params.extensions.join(' ')}` : '';
    const filterFlag = params.filterStatus ? `--filter-status ${params.filterStatus.join(',')}` : '--filter-status 404';
    const cmd = `feroxbuster -u ${params.url} -w ${wl} -d ${params.depth || 3} -t ${params.threads || 50} ${extFlag} ${filterFlag} --json -o /dev/stdout`;
    const result = await execSecure(cmd, { timeout: 600000 });
    return { results: result.stdout.split('\n').filter(Boolean).map(JSON.parse) };
  },
};
```

## Parameters
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| url | string |; | Target URL |
| depth | number | 3 | Recursion depth |
| extensions | array | [php,html,js,txt] | Extensions |
| threads | number | 50 | Concurrent |
| wordlist | string | raft-medium | Wordlist |
| filterStatus | array | [404] | Filter codes |

## Pitfalls
1. **Deep recursion**; depth 5+ can discover millions of paths; use aggressive filtering
2. **Rust binary**; installed via cargo/apt; not always pre-installed on Kali

## Verification
```bash
which feroxbuster && feroxbuster --version
feroxbuster -u https://example.com -t 2 --depth 1 -x html
```
