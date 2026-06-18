# Tool: nuclei | #11 | Template-Based Vulnerability Scanner

## Metadata
- **Priority:** CRITICAL
- **Source:** Kali Linux
- **Binary:** `nuclei`
- **Package:** `nuclei` (or `go install -v github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest`)
- **Risk Level:** medium
- **Requires Human Approval:** no
- **OS Compatibility:** kali, parrot, any

## Purpose
Fast, template-based vulnerability scanner. Nuclei uses YAML templates to detect CVEs, misconfigurations, exposed panels, default credentials, and secrets across web applications, APIs, cloud infrastructure, and networks. Carina uses nuclei as the primary automated vulnerability assessment engine; running hundreds of templates against discovered targets.

## Carina CLI Command
```
carina vuln scan <target> [--templates all|cve|misconfig|exposures|tech|default-logins|dast]
                          [--severity critical,high,medium,low] [--rate-limit N]
```

## TypeScript Wrapper

```typescript
export const nucleiTool: ToolDefinition = {
  name: 'nuclei_scan',
  description: 'Template-based vulnerability scanner; CVEs, misconfigs, exposures, default creds, secrets.',
  parameters: {
    target:       { type: 'string', description: 'URL, host, IP, or file of targets', required: true },
    templates:    { type: 'enum', values: ['all','cve','misconfig','exposures','tech','default-logins','dast','secrets'], default: 'all' },
    severity:     { type: 'array', items: 'string', description: 'Filter by severity', default: ['critical','high','medium'] },
    rateLimit:    { type: 'number', default: 150, description: 'Requests per second' },
    customTemplates: { type: 'string', description: 'Path to custom template dir', required: false },
    timeout:      { type: 'number', default: 600, description: 'Max seconds' },
    proxy:        { type: 'string', description: 'Proxy URL (e.g. http://127.0.0.1:8080)', required: false },
  },
  requires: ['nuclei'],
  risk: 'medium',
  category: 'vuln',
  handler: async (params, ctx) => {
    const sev = (params.severity || ['critical','high','medium']).join(',');
    const templateFlag = params.templates === 'all' ? '-automatic-scan' : `-t ${params.templates}/`;
    const customFlag = params.customTemplates ? `-t ${params.customTemplates}` : '';
    const proxyFlag = params.proxy ? `-proxy ${params.proxy}` : '';
    const cmd = `nuclei -u ${params.target} ${templateFlag} ${customFlag} -severity ${sev} -rl ${params.rateLimit || 150} ${proxyFlag} -json -stats -timeout ${params.timeout || 600}`;
    const result = await execSecure(cmd, { timeout: (params.timeout || 600) * 1000 });
    return { findings: result.stdout.split('\n').filter(Boolean).map(JSON.parse) };
  },
};
```

## Template Categories
| Category | Templates | Description |
|----------|-----------|-------------|
| cve | 1000+ | Known CVEs (Log4j, Spring4Shell, etc.) |
| misconfig | 500+ | Security misconfigurations |
| exposures | 300+ | Exposed panels, files, APIs |
| tech | 200+ | Technology detection |
| default-logins | 150+ | Default credentials |
| dast | 100+ | Dynamic application testing |
| secrets | 50+ | Exposed API keys, tokens |

## Workflow Chains
```
UPSTREAM:   01-nmap (discovered ports/services), 02-amass (subdomains)
DOWNSTREAM: 18-metasploit (exploit confirmed vulns), 26-burpsuite (manual validation)
CHAINS:     nuclei → metasploit (auto-exploit confirmed CVEs)
            nuclei finding → carina report (generate finding with CVSS + remediation)
```

## Structured Output
```json
{
  "target": "https://example.com",
  "templates_used": 3421,
  "duration": 180,
  "findings": [
    {
      "template": "cves/2023/CVE-2023-XXXX",
      "name": "nginx < 1.25.0 HTTP/2 Rapid Reset",
      "severity": "high",
      "matched": "https://example.com:443",
      "description": "HTTP/2 Rapid Reset vulnerability detected in nginx",
      "remediation": "Upgrade nginx to 1.25.0 or later",
      "cvss": 7.5,
      "curl_command": "curl -k 'https://example.com' -H '...'"
    }
  ]
}
```

## Pitfalls
1. **False positives**; template-based scanning produces false positives; always validate
2. **Rate limiting**; 150 req/s may trigger WAF; reduce to 50 for sensitive targets
3. **Template updates**; run `nuclei -update-templates` daily; templates evolve fast
4. **Auth targets**; needs cookies/tokens for authenticated scanning; pass via -H
5. **Scope creep**; -automatic-scan follows redirects; may scan out-of-scope hosts
6. **WAF bypass**; some WAFs detect nuclei fingerprints; use -p for request randomization
7. **Memory usage**; loading all templates consumes ~2GB RAM

## Verification
```bash
which nuclei && nuclei -version
nuclei -update-templates
nuclei -u https://example.com -severity critical,high -stats -timeout 60
```
