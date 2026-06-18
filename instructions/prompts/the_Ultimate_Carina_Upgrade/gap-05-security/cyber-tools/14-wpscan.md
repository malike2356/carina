# Tool: wpscan | #14 | WordPress Security Scanner

## Metadata
- **Priority:** HIGH
- **Source:** Kali Linux
- **Binary:** `wpscan`
- **Package:** `wpscan`
- **Risk Level:** medium
- **Requires Human Approval:** no
- **OS Compatibility:** kali, parrot

## Purpose
WordPress-specific vulnerability scanner. Enumerates plugins, themes, users, timthumb files, config backups, and database dumps. Checks against the WPVulnDB API for known vulnerabilities in WordPress core, plugins, and themes. Critical for the 43% of websites running WordPress.

## Carina CLI Command
```
carina vuln wordpress <url> [--enumerate p,t,u,tt,cb,dbe] [--api-token <key>] [--stealthy]
```

## TypeScript Wrapper

```typescript
export const wpscanTool: ToolDefinition = {
  name: 'wpscan_scan',
  description: 'WordPress scanner; plugins, themes, users, vulns from WPVulnDB.',
  parameters: {
    url:       { type: 'string', description: 'WordPress site URL', required: true },
    enumerate: { type: 'array', items: 'string', description: 'p=plugins, t=themes, u=users, tt=timthumbs, cb=config backups, dbe=db exports', default: ['p','t','u'] },
    apiToken:  { type: 'string', description: 'WPVulnDB API token', required: false },
    stealthy:  { type: 'boolean', default: false },
    output:    { type: 'string', description: 'Output file (JSON)', required: false },
  },
  requires: ['wpscan'],
  risk: 'medium',
  category: 'vuln',
  handler: async (params, ctx) => {
    const enumFlag = params.enumerate ? `-e ${params.enumerate.join(',')}` : '-e p,t,u';
    const tokenFlag = params.apiToken ? `--api-token ${params.apiToken}` : '';
    const stealthFlag = params.stealthy ? '--stealthy --random-user-agent' : '';
    const cmd = `wpscan --url ${params.url} ${enumFlag} ${tokenFlag} ${stealthFlag} -f json`;
    const result = await execSecure(cmd, { timeout: 300000 });
    return JSON.parse(result.stdout);
  },
};
```

## Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| url | string | yes |; | Target WordPress URL |
| enumerate | array | no | [p,t,u] | Components to enumerate |
| apiToken | string | no |; | WPVulnDB API token |
| stealthy | boolean | no | false | Random user-agent, delay requests |

## Pitfalls
1. **API token needed**; vulnerability data requires free WPVulnDB API token
2. **Plugin detection noisy**; brute-forces plugin paths (1000+ requests)
3. **Custom themes**; may miss custom/renamed themes
4. **WAF blocking**; some security plugins block wpscan user-agent

## Verification
```bash
which wpscan && wpscan --version
wpscan --url https://example.com --enumerate p --timeout 30
```
