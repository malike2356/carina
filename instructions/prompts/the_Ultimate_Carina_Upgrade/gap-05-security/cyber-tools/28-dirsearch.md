# Tool: dirsearch | #28 | Web Path Scanner

## Metadata
- **Priority:** HIGH; **Source:** Kali; **Binary:** `dirsearch`; **Package:** `dirsearch`
- **Risk:** medium; **Approval:** no; **OS:** kali, parrot, any

## Purpose
Web path brute-forcer with recursive scanning, extension lists, and custom headers. Faster than gobuster for targeted scans and supports proxy rotation. Carina uses dirsearch as a secondary directory enumerator for cross-validation.

## Carina CLI Command
```
carina fuzz dirs <url> --engine dirsearch [--extensions php,asp] [--recursive] [--threads N]
```

## TypeScript Wrapper

```typescript
export const dirsearchTool: ToolDefinition = {
  name: 'dirsearch_scan',
  description: 'Web path scanner; recursive, extension-aware, proxy rotation.',
  parameters: {
    url: { type: 'string', required: true },
    extensions: { type: 'array', items: 'string', default: ['php','asp','jsp','html','js','txt'] },
    recursive: { type: 'boolean', default: false },
    threads: { type: 'number', default: 25 },
    wordlist: { type: 'string' },
    cookie: { type: 'string' },
    proxy: { type: 'string' },
  },
  requires: ['dirsearch'],
  risk: 'medium',
  category: 'web',
  handler: async (params, ctx) => {
    const extFlag = params.extensions ? `-e ${params.extensions.join(',')}` : '-e php,asp,jsp,html';
    const rFlag = params.recursive ? '--recursive' : '';
    const cmd = `dirsearch -u ${params.url} ${extFlag} ${rFlag} -t ${params.threads || 25} -w ${params.wordlist || '/usr/share/seclists/Discovery/Web-Content/common.txt'} --format json -o /dev/stdout`;
    const result = await execSecure(cmd, { timeout: 300000 });
    return JSON.parse(result.stdout);
  },
};
```

## Output
```json
{"results": [
  {"url": "https://example.com/admin/", "status": 200, "contentLength": 1234},
  {"url": "https://example.com/.git/config", "status": 200, "contentLength": 89}
]}
```

## Pitfalls
1. WAF blocking; reduce threads; use --delay
2. Python dependency; requires Python3 and pip packages
3. Recursion danger; recursive mode can go deep; limit with --recursion-depth

## Verification
```bash
which dirsearch
dirsearch -u https://example.com -e php -t 2 --timeout 10
```
