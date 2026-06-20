# Tool: nikto | #12 | Web Server Scanner

## Metadata
- **Priority:** CRITICAL
- **Source:** Kali Linux
- **Binary:** `nikto`
- **Package:** `nikto`
- **Risk Level:** medium
- **Requires Human Approval:** no
- **OS Compatibility:** kali, parrot

## Purpose
Web server vulnerability scanner. Nikto checks for 6700+ potentially dangerous files/CGIs, outdated server versions, version-specific problems, and server misconfigurations. Complements nuclei by focusing on web-server-level issues rather than application vulnerabilities.

## Carina CLI Command
```
carina vuln web <target> [--port N] [--ssl] [--tuning 1-9] [--output json|html|csv]
```

## TypeScript Wrapper

```typescript
export const niktoTool: ToolDefinition = {
  name: 'nikto_scan',
  description: 'Web server scanner; 6700+ checks for dangerous files, outdated versions, misconfigs.',
  parameters: {
    target:   { type: 'string', description: 'Host or IP', required: true },
    port:     { type: 'number', description: 'Port (default: 80)', default: 80 },
    ssl:      { type: 'boolean', default: false, description: 'Use SSL/TLS' },
    tuning:   { type: 'array', items: 'number', description: 'Tuning options 1-9', default: [1,2,3,4,5,6,7,8,9] },
    output:   { type: 'enum', values: ['json','html','csv','xml'], default: 'json' },
    id:       { type: 'string', description: 'Host header value', required: false },
  },
  requires: ['nikto'],
  risk: 'medium',
  category: 'vuln',
  handler: async (params, ctx) => {
    const protocol = params.ssl ? 'https' : 'http';
    const target = `${protocol}://${params.target}:${params.port}`;
    const tuningFlag = params.tuning ? `-T ${params.tuning.join('')}` : '-T 123456789';
    const idFlag = params.id ? `-id ${params.id}` : '';
    const cmd = `nikto -h ${target} ${tuningFlag} ${idFlag} -Format json -o /dev/stdout`;
    const result = await execSecure(cmd, { timeout: 60000 });
    return JSON.parse(result.stdout);
  },
};
```

## Tuning Options
| # | Category | # | Category |
|---|----------|---|----------|
| 1 | File Upload | 6 | Injection (XSS/SQL) |
| 2 | Misconfigs / Defaults | 7 | File Enumeration |
| 3 | Info Disclosure | 8 | Outdated Software |
| 4 | XSS / Script Injection | 9 | Auth Bypass + Misc |
| 5 | Directory Browsing | | |

## Workflow Chains
```
UPSTREAM:   01-nmap (web ports 80/443/8080 discovered)
DOWNSTREAM: 11-nuclei (detailed app-level vuln scanning)
CHAINS:     nmap → nikto → nuclei (server-level → app-level vuln scan)
```

## Structured Output
```json
{
  "target": "http://example.com:80",
  "server": "nginx/1.24.0",
  "findings": [
    { "id": "999999", "method": "GET", "uri": "/.git/HEAD", "description": "Git repository found", "osvdb": "0" },
    { "id": "740001", "method": "OPTIONS", "uri": "/", "description": "Allowed HTTP Methods: GET, HEAD, POST, OPTIONS, PUT, DELETE", "osvdb": "0" }
  ]
}
```

## Pitfalls
1. **Noisy**; generates thousands of requests; easily detected by IDS/WAF
2. **False positives**; many findings are informational, not exploitable
3. **Slow**; full scan (all tunings) can take 30+ minutes per host
4. **Perl dependency**; requires libwhisker2; check installation
5. **No JavaScript**; doesn't handle SPAs or JS-rendered content

## Verification
```bash
which nikto && nikto -Version
nikto -h http://example.com -T 1 -timeout 10
```
