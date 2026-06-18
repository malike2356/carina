# Tool: ffuf | #27 | Fast Web Fuzzer

## Metadata
- **Priority:** CRITICAL
- **Source:** Kali Linux
- **Binary:** `ffuf`
- **Package:** `ffuf`
- **Risk Level:** medium
- **Requires Human Approval:** no
- **OS Compatibility:** kali, parrot, any

## Purpose
Fast web fuzzer (Fuzz Faster U Fool). Discovers hidden directories, files, virtual hosts, parameters, and subdomains via high-speed HTTP fuzzing. Written in Go; blazing fast with wordlist-based brute forcing. Carina uses ffuf for content discovery before vulnerability scanning.

## Carina CLI Command
```
carina fuzz dirs <url> [--wordlist <file>] [--threads N] [--extensions php,asp,js,...]
carina fuzz vhost <domain> [--wordlist <file>]
carina fuzz params <url> [--wordlist <file>]
```

## TypeScript Wrapper

```typescript
export const ffufTool: ToolDefinition = {
  name: 'ffuf_fuzz',
  description: 'Fast web fuzzer; directories, files, vhosts, parameters, subdomains.',
  parameters: {
    url:        { type: 'string', description: 'Target URL with FUZZ keyword', required: true },
    wordlist:   { type: 'string', description: 'Wordlist path', required: false },
    mode:       { type: 'enum', values: ['dir', 'vhost', 'param', 'subdomain'], default: 'dir' },
    extensions: { type: 'array', items: 'string', description: 'File extensions', default: ['php','html','js','txt','bak'] },
    threads:    { type: 'number', default: 40, description: 'Concurrent threads' },
    filterCode: { type: 'string', description: 'Filter HTTP status codes (e.g. 404,403)' },
    matchCode:  { type: 'string', description: 'Match only these HTTP codes (e.g. 200,302)' },
    timeout:    { type: 'number', default: 600 },
  },
  requires: ['ffuf'],
  risk: 'medium',
  category: 'web',
  handler: async (params, ctx) => {
    const wl = params.wordlist || '/usr/share/wordlists/dirb/common.txt';
    const extFlag = params.extensions ? `-e .${params.extensions.join(',.')}` : '';
    const filterFlag = params.filterCode ? `-fc ${params.filterCode}` : '';
    const matchFlag = params.matchCode ? `-mc ${params.matchCode}` : '';
    const modeUrls: Record<string,string> = {
      dir: `${params.url}/FUZZ`,
      vhost: `http://FUZZ.${params.url}`,
      subdomain: `http://FUZZ.${params.url}`,
      param: `${params.url}?FUZZ=test`,
    };
    const cmd = `ffuf -u "${modeUrls[params.mode]}" -w ${wl} -t ${params.threads} ${extFlag} ${filterFlag} ${matchFlag} -of json -o /dev/stdout`;
    const result = await execSecure(cmd, { timeout: (params.timeout || 600) * 1000 });
    return JSON.parse(result.stdout);
  },
};
```

## Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| url | string | yes |; | Target URL (use FUZZ keyword) |
| wordlist | string | no | common.txt | Wordlist for fuzzing |
| mode | enum | no | dir | dir/vhost/param/subdomain |
| extensions | array | no | [php,html,...] | File extensions |
| threads | number | no | 40 | Concurrent threads |
| filterCode | string | no |; | Filter status codes |
| matchCode | string | no |; | Match status codes |

## Workflow Chains
```
UPSTREAM:   26-burpsuite (discovered endpoints)
DOWNSTREAM: 13-sqlmap (injectable params), 11-nuclei (scan discovered dirs)
```

## Pitfalls
1. **WAF detection**; high thread count triggers WAF rate limiting
2. **Wordlist quality**; results depend entirely on wordlist; use SecLists
3. **Recursion**; ffuf can recurse (-recursion) but can go infinite; set -recursion-depth

## Verification
```bash
which ffuf && ffuf -V
ffuf -u https://example.com/FUZZ -w /usr/share/wordlists/dirb/common.txt -t 5 -timeout 10
```
