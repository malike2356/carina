# Tool: arjun | #31 | HTTP Parameter Discovery


## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`

## Metadata
- **Priority:** MEDIUM; **Source:** Kali; **Binary:** `arjun`
- **Package:** `arjun` (pip); **Risk:** low; **Approval:** no; **OS:** any (Python)

## Purpose
HTTP parameter discovery tool. Finds hidden GET/POST/JSON/XML parameters on web endpoints by brute-forcing 25,000+ parameter names. Critical for finding attack surface that scanners miss; hidden params often lead to IDOR, SSRF, and logic bugs.

## Carina CLI Command
```
carina fuzz params <url> [--method GET|POST|JSON] [--wordlist <file>] [--threads N]
```

## TypeScript Wrapper

```typescript
export const arjunTool: ToolDefinition = {
  name: 'arjun_params',
  description: 'Hidden HTTP parameter discovery; GET, POST, JSON, XML.',
  parameters: {
    url: { type: 'string', required: true },
    method: { type: 'enum', values: ['GET', 'POST', 'JSON', 'XML'], default: 'GET' },
    wordlist: { type: 'string' },
    threads: { type: 'number', default: 10 },
    headers: { type: 'object' },
  },
  requires: ['arjun'],
  risk: 'low',
  category: 'web',
  handler: async (params, ctx) => {
    const wl = params.wordlist || '/usr/share/wordlists/arjun/large.txt';
    const hFlag = params.headers ? `--headers '${JSON.stringify(params.headers)}'` : '';
    const cmd = `arjun -u ${params.url} -m ${params.method} -w ${wl} -t ${params.threads || 10} ${hFlag} -oJ /dev/stdout`;
    const result = await execSecure(cmd, { timeout: 120000 });
    return JSON.parse(result.stdout);
  },
};
```

## Output
```json
{
  "url": "https://example.com/api/items",
  "method": "GET",
  "params_found": ["id", "user", "token", "admin", "debug", "file", "path"],
  "wordlist_size": 25478,
  "time": 45.2
}
```

## Workflow Chains
```
UPSTREAM:   27-ffuf (discovered endpoints)
DOWNSTREAM: 13-sqlmap (injectable params), 32-sstimap (SSTI on found params)
```

## Pitfalls
1. **WAF detection**; parameter brute force triggers WAF; use delay/rotation
2. **False positives**; reflection-based detection yields false positives; validate manually

## Verification
```bash
which arjun
arjun -u https://example.com/api/test -m GET -t 2 --timeout 10
```
