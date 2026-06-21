# Tool: dmitry | #08 | Deepmagic Recon


## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`

## Metadata
- **Priority:** MEDIUM
- **Source:** Kali Linux
- **Binary:** `dmitry`
- **Package:** `dmitry`
- **Risk Level:** medium
- **Requires Human Approval:** no
- **OS Compatibility:** kali

## Purpose
All-in-one information gathering tool (Deepmagic Information Gathering). Performs WHOIS lookups, subdomain discovery, email harvesting, TCP port scanning, and banner grabbing in a single pass. Lightweight alternative to running nmap + whois + theHarvester separately.

## Carina CLI Command
```
carina recon dmitry <target> [--modules whois|subdomains|email|ports|banner|all]
```

## TypeScript Wrapper

```typescript
export const dmitryTool: ToolDefinition = {
  name: 'dmitry_gather',
  description: 'All-in-one: WHOIS, subdomains, email, port scan, banner grab.',
  parameters: {
    target:    { type: 'string', description: 'Domain or IP', required: true },
    modules:   { type: 'enum', values: ['whois','subdomains','email','ports','banner','all'], default: 'all' },
    output:    { type: 'string', description: 'Output file path', required: false },
  },
  requires: ['dmitry'],
  risk: 'medium',
  category: 'recon',
  handler: async (params, ctx) => {
    const outFlag = params.output ? `-o ${params.output}` : '-o /dev/stdout';
    const moduleFlags: Record<string,string> = {
      whois:'-w', subdomains:'-s', email:'-e', ports:'-p', banner:'-pb', all:'-winsepfb'
    };
    const cmd = `dmitry ${moduleFlags[params.modules]} ${outFlag} ${params.target}`;
    const result = await execSecure(cmd, { timeout: 120000 });
    return parseDmitryOutput(result.stdout);
  },
};
```

## Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| target | string | yes |; | Domain or IP |
| modules | enum | no | all | Data modules to run |
| output | string | no |; | Output file |

## Flags
| Flag | Module | Description |
|------|--------|-------------|
| -w | whois | WHOIS lookup on IP/domain |
| -i | info | Netcraft.com info |
| -s | subdomains | Subdomain search |
| -e | email | Email address search |
| -p | ports | TCP port scan |
| -b | banner | Banner grab from open ports |
| -f | filtered | Show filtered ports |

## Structure Output
```json
{
  "target": "example.com", "ip": "93.184.216.34",
  "whois": { "registrar": "IANA", "created": "1995-08-14", "expires": "2025-08-13" },
  "subdomains": ["www.example.com", "dev.example.com"],
  "emails": ["admin@example.com"],
  "ports": [{ "port": 80, "state": "open" }, { "port": 443, "state": "open" }]
}
```

## Pitfalls
1. **Kali-only**; not in standard apt; use `apt install dmitry` on Kali
2. **Limited depth**; not as thorough as dedicated tools; use as quick first pass
3. **No stealth**; port scan is TCP connect (detectable)
4. **Banner grab noisy**; triggers IDS on some networks

## Verification
```bash
which dmitry
dmitry -w example.com
```
