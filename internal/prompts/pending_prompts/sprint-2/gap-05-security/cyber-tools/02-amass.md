# Tool: amass | #02 | Reconnaissance


## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`

## Metadata
- **Priority:** CRITICAL
- **Source:** Kali Linux
- **Binary:** `amass`
- **Package:** `amass`
- **Risk Level:** medium
- **Requires Human Approval:** no
- **OS Compatibility:** kali, parrot, any

## Purpose
Subdomain enumeration and attack surface mapping. Amass uses passive (DNS, cert transparency, search engines) and active (brute force, zone transfers) techniques to discover all subdomains of a target domain. Essential for mapping the full external attack surface.

## Carina CLI Command
```
carina recon subdomains <domain> [--mode passive|active|full] [--depth N]
```

## TypeScript Wrapper

```typescript
export const amassTool: ToolDefinition = {
  name: 'amass_enum',
  description: 'Subdomain enumeration; passive DNS, cert transparency, brute force, zone transfers.',
  parameters: {
    domain:     { type: 'string', description: 'Target domain (e.g., example.com)', required: true },
    mode:       { type: 'enum', values: ['passive', 'active', 'full'], default: 'passive', description: 'passive=no direct contact, active=brute force+zone xfer, full=both' },
    depth:      { type: 'number', default: 3, description: 'Subdomain depth for brute force (1-10)' },
    wordlist:   { type: 'string', description: 'Custom wordlist path for brute force', required: false },
    timeout:    { type: 'number', default: 600, description: 'Max seconds' },
  },
  requires: ['amass'],
  risk: 'medium',
  category: 'recon',
  handler: async (params, ctx) => {
    const modeFlag = params.mode === 'active' ? '-active' : params.mode === 'full' ? '' : '-passive';
    const depthFlag = params.mode !== 'passive' ? `-brute -min-for-recursive ${params.depth || 3}` : '';
    const wordlistFlag = params.wordlist ? `-w ${params.wordlist}` : '';
    const cmd = `amass enum ${modeFlag} -d ${params.domain} ${depthFlag} ${wordlistFlag} -json /dev/stdout -timeout ${params.timeout || 600}`;
    const result = await execSecure(cmd, { timeout: (params.timeout || 600) * 1000 });
    return { subdomains: result.stdout.split('\n').filter(Boolean).map(JSON.parse) };
  },
};
```

## Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| domain | string | yes |; | Target domain |
| mode | enum | no | passive | passive/active/full |
| depth | number | no | 3 | Brute force depth (1-10) |
| wordlist | string | no |; | Custom wordlist for brute forcing |
| timeout | number | no | 600 | Max seconds |

## Workflow Chains
```
UPSTREAM:   01-nmap (domains discovered from SSL certs)
DOWNSTREAM: 03-theHarvester, 11-nuclei, 12-nikto
CHAINS:     amass → nuclei (scan each discovered subdomain)
            amass → theHarvester (enrich with email/employee data)
```

## Usage Examples
```bash
carina recon subdomains example.com --mode passive
carina recon subdomains example.com --mode full --depth 5
carina recon subdomains example.com --mode active --wordlist /usr/share/wordlists/subdomains-top1m.txt
```

## Structured Output
```json
{
  "domain": "example.com",
  "mode": "passive",
  "totalSubdomains": 47,
  "subdomains": [
    { "name": "www.example.com", "ip": "93.184.216.34", "source": "DNS" },
    { "name": "mail.example.com", "ip": "93.184.216.35", "source": "CertTransparency" },
    { "name": "admin.example.com", "ip": "10.0.1.5", "source": "DNS" }
  ]
}
```

## Pitfalls
1. **Active mode generates traffic**; detectable by target; use passive for stealth
2. **Rate limiting on DNS**; some resolvers block aggressive queries; use -r to specify resolvers
3. **Large domains**; example.com might have thousands; set depth conservatively
4. **API keys**; some passive sources need API keys (Shodan, Censys, etc.)
5. **Zone transfer rare**; don't rely on AXFR; most DNS servers block it
6. **Output size**; large domains can produce massive JSON; stream-don't-buffer

## Verification
```bash
which amass && amass -version
amass enum -passive -d example.com -timeout 60
```
