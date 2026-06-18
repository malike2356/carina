# Tool: spiderfoot | #05 | Automated OSINT

## Metadata
- **Priority:** HIGH
- **Source:** Kali Linux
- **Binary:** `spiderfoot` (CLI: `sf`)
- **Package:** `spiderfoot`
- **Risk Level:** low
- **Requires Human Approval:** no
- **OS Compatibility:** kali, parrot

## Purpose
Automated OSINT automation platform with 200+ modules. Spiderfoot queries 100+ data sources (SHODAN, HaveIBeenPwned, SecurityTrails, AlienVault, etc.) to build a comprehensive target profile: IPs, domains, emails, social media, vulnerabilities, leaked credentials, and dark web mentions. Carina orchestrates Spiderfoot as the "fire and forget" recon engine.

## Carina CLI Command
```
carina recon spiderfoot <target> [--modules all|recon|vuln|darknet] [--scan-id <id>]
```

## TypeScript Wrapper

```typescript
export const spiderfootTool: ToolDefinition = {
  name: 'spiderfoot_scan',
  description: 'Automated OSINT with 200+ modules; IP, domain, email, vuln, dark web, leaked creds.',
  parameters: {
    target:      { type: 'string', description: 'IP, domain, email, or CIDR', required: true },
    targetType:  { type: 'enum', values: ['ip', 'domain', 'email', 'cidr', 'name', 'asn'], required: true },
    modules:     { type: 'enum', values: ['all', 'recon', 'vuln', 'darknet', 'leaks', 'passive'], default: 'all' },
    scanId:      { type: 'string', description: 'Resume existing scan', required: false },
    timeout:     { type: 'number', default: 1800, description: 'Max seconds (30 min default)' },
  },
  requires: ['spiderfoot'],
  risk: 'low',
  category: 'recon',
  handler: async (params, ctx) => {
    const cmd = `sf -s ${params.target} -t ${params.targetType} -m ${params.modules} -o json`;
    const result = await execSecure(cmd, { timeout: (params.timeout || 1800) * 1000 });
    return JSON.parse(result.stdout);
  },
};
```

## Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| target | string | yes |; | IP, domain, email, CIDR, name, ASN |
| targetType | enum | yes |; | ip/domain/email/cidr/name/asn |
| modules | enum | no | all | Module group to run |
| scanId | string | no |; | Resume existing scan |
| timeout | number | no | 1800 | Max seconds |

## Module Groups
- **all:** Every module (200+)
- **recon:** IP, domain, subdomain, DNS, SSL
- **vuln:** CVEs, exploits, misconfigurations
- **darknet:** Tor, dark web mentions
- **leaks:** HaveIBeenPwned, pastebins, credential dumps
- **passive:** No direct target contact

## Workflow Chains
```
UPSTREAM:   02-amass (domain list), 03-theHarvester (emails)
DOWNSTREAM: 11-nuclei (vuln validation), 07-maltego (graph)
CHAINS:     spiderfoot → nuclei (validate discovered vulnerabilities)
            spiderfoot → metasploit (exploit confirmed CVEs)
```

## Structured Output (truncated)
```json
{
  "target": "example.com",
  "modules": 187,
  "findings": {
    "domains": ["example.com", "www.example.com", "dev.example.com"],
    "ips": ["93.184.216.34", "10.0.1.5"],
    "emails": ["admin@example.com"],
    "vulnerabilities": ["CVE-2023-XXXX - nginx < 1.25"],
    "leaks": ["credential found in breach: 2022-collection"],
    "darkweb": ["mention on forum X; 'example.com vulnerable'"],
    "social": ["@example on Twitter", "John Doe - LinkedIn"]
  },
  "severity": "HIGH",
  "duration": 1245
}
```

## Pitfalls
1. **Extremely slow**; full scan with 200 modules can take hours; start narrow
2. **API key requirement**; 70% of modules need API keys (Shodan, VirusTotal, etc.)
3. **Memory hungry**; large results can consume 2-4GB RAM
4. **False positives**; leaked creds may be stale/incorrect
5. **Web UI vs CLI**; CLI (`sf`) is what Carina uses; web UI on port 5001 for manual review
6. **Resume support**; always use scanId for long scans to enable resume

## Verification
```bash
which sf && sf --version
sf -s example.com -t domain -m passive -o json | head -50
```
