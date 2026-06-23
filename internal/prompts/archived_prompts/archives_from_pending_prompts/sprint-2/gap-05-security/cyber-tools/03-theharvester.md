# Tool: theHarvester | #03 | OSINT


## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`

## Metadata
- **Priority:** HIGH
- **Source:** Kali Linux
- **Binary:** `theHarvester`
- **Package:** `theharvester`
- **Risk Level:** low
- **Requires Human Approval:** no
- **OS Compatibility:** kali, parrot

## Purpose
Email, subdomain, employee name, and open port gathering from public sources. Queries Google, Bing, Shodan, LinkedIn, DNSDumpster, and 20+ other sources to build an organizational footprint without touching the target directly.

## Carina CLI Command
```
carina recon osint <domain> [--source all|google|linkedin|shodan|...] [--limit N]
```

## TypeScript Wrapper

```typescript
export const SOURCES = ['all','google','bing','yahoo','baidu','shodan','linkedin',
  'dnsdumpster','virustotal','threatcrowd','crtsh','bufferoverun','anubis'];

export const theHarvesterTool: ToolDefinition = {
  name: 'theharvester_gather',
  description: 'Passive OSINT: emails, subdomains, names, IPs from 20+ public sources.',
  parameters: {
    domain:     { type: 'string', description: 'Target domain', required: true },
    source:     { type: 'enum', values: SOURCES, default: 'all', description: 'Data source' },
    limit:      { type: 'number', default: 500, description: 'Max results per source' },
  },
  requires: ['theHarvester'],
  risk: 'low',
  category: 'recon',
  handler: async (params, ctx) => {
    const srcFlag = params.source === 'all' ? '-b all' : `-b ${params.source}`;
    const cmd = `theHarvester -d ${params.domain} ${srcFlag} -l ${params.limit || 500} -f /dev/stdout`;
    const result = await execSecure(cmd, { timeout: 120000 });
    return parseHarvesterOutput(result.stdout);
  },
};
```

## Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| domain | string | yes |; | Target domain |
| source | enum | no | all | Data source(s) to query |
| limit | number | no | 500 | Max results per source |

## Sources
`all` `google` `bing` `yahoo` `baidu` `shodan` `linkedin` `dnsdumpster` `virustotal` `threatcrowd` `crtsh` `bufferoverun` `anubis` `certspotter` `hunter` `intelx` `omnisint` `rapiddns` `sublist3r` `urlscan`

## Workflow Chains
```
UPSTREAM:   02-amass (domain list)
DOWNSTREAM: 07-maltego (graph enrichment), 11-nuclei
CHAINS:     theHarvester → maltego (email→name→social graph)
            theHarvester → nuclei (scan discovered subdomains)
```

## Structured Output
```json
{
  "domain": "example.com",
  "sources": ["google", "linkedin", "crtsh"],
  "emails": ["admin@example.com", "john.doe@example.com"],
  "hosts": ["www.example.com", "mail.example.com", "dev.example.com"],
  "ips": ["93.184.216.34"],
  "employees": ["John Doe - CTO", "Jane Smith - DevOps"],
  "urls": ["https://example.com/admin"]
}
```

## Pitfalls
1. **API rate limits**; Google/Bing block after ~100 queries; rotate sources
2. **LinkedIn needs auth**; some employee data requires LinkedIn API key
3. **False positives**; email formats can be guessed; verify before using
4. **Results vary by source**; `all` is slowest but most thorough
5. **Passive only**; never touches target; safe for bug bounty recon
6. **DNS resolution**; discovered subdomains may be stale; re-resolve

## Verification
```bash
which theHarvester
theHarvester -d example.com -b google -l 10
```
