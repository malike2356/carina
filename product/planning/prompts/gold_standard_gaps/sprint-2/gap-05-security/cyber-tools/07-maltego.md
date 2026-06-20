# Tool: maltego | #07 | Graph OSINT

## Metadata
- **Priority:** MEDIUM
- **Source:** Kali Linux
- **Binary:** `maltego`
- **Package:** `maltego`
- **Risk Level:** low
- **Requires Human Approval:** no
- **OS Compatibility:** kali, parrot
- **Note:** Requires Community or Commercial license. Free Community Edition has limited transforms/day.

## Purpose
Graph-based link analysis and OSINT platform. Maltego visualizes relationships between entities (people, domains, IPs, emails, social profiles) through automated transforms; discovering hidden connections, infrastructure links, and attack paths that text-based tools miss.

## Carina CLI Command
```
carina recon graph <entity> [--type domain|email|ip|person] [--depth 2] [--output png|pdf|json]
```

## TypeScript Wrapper

```typescript
export const maltegoTool: ToolDefinition = {
  name: 'maltego_graph',
  description: 'Graph-based OSINT link analysis; entity relationship mapping.',
  parameters: {
    entity:      { type: 'string', description: 'Domain, email, IP, or name', required: true },
    entityType:  { type: 'enum', values: ['domain', 'email', 'ip', 'person', 'company'], required: true },
    depth:       { type: 'number', default: 2, description: 'Transform depth (1-5)' },
    output:      { type: 'enum', values: ['json', 'png', 'pdf', 'graphml'], default: 'json' },
    transforms:  { type: 'array', items: 'string', description: 'Specific transforms to run' },
  },
  requires: ['maltego'],
  risk: 'low',
  category: 'recon',
  handler: async (params, ctx) => {
    // Maltego is primarily GUI-driven. Carina uses the TRX (Transform) API or headless mode.
    const cmd = `maltego --headless --entity ${params.entityType}:${params.entity} --depth ${params.depth} --format ${params.output}`;
    const result = await execSecure(cmd, { timeout: 300000 });
    return params.output === 'json' ? JSON.parse(result.stdout) : { output: result.stdout, type: params.output };
  },
};
```

## Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| entity | string | yes |; | Domain, email, IP, or name |
| entityType | enum | yes |; | domain/email/ip/person/company |
| depth | number | no | 2 | Transform depth (1-5) |
| output | enum | no | json | Output format |
| transforms | array | no |; | Specific transforms |

## Common Transforms
- `DomainToIP`; Resolve domain to IP
- `IPToDomain`; Reverse DNS
- `EmailToDomain`; Extract domain from email
- `DomainToMX`; Mail server discovery
- `DomainToNS`; Nameserver discovery
- `DomainToWhois`; WHOIS lookup
- `EmailToSocial`; Find social profiles from email

## Pitfalls
1. **License required**; Community Edition has severe transform limits
2. **GUI primary**; headless automation is limited; best used interactively
3. **Slow transforms**; depth > 3 can produce massive graphs; set limits
4. **Data freshness**; cached transforms may return stale data; clear cache

## Verification
```bash
which maltego
maltego --version
```
