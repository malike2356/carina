# Tool: whatweb | #15 | Web Technology Fingerprinting


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
- **Binary:** `whatweb`
- **Package:** `whatweb`
- **Risk Level:** low
- **Requires Human Approval:** no
- **OS Compatibility:** kali, parrot

## Purpose
Identifies websites' technology stacks: CMS, JavaScript frameworks, analytics, CDN, server software, programming languages, and 1800+ other technologies. Passively determines what a site is built with; essential for targeting the right vulnerability scanners.

## Carina CLI Command
```
carina vuln fingerprint <url> [--aggression 1-4] [--output json]
```

## TypeScript Wrapper

```typescript
export const whatwebTool: ToolDefinition = {
  name: 'whatweb_fingerprint',
  description: 'Web technology fingerprinting; CMS, frameworks, server, CDN, analytics (1800+ plugins).',
  parameters: {
    url:       { type: 'string', description: 'Target URL', required: true },
    aggression:{ type: 'number', default: 3, description: 'Stealth 1 → Aggressive 4' },
  },
  requires: ['whatweb'],
  risk: 'low',
  category: 'vuln',
  handler: async (params, ctx) => {
    const cmd = `whatweb -a ${params.aggression || 3} --log-json=/dev/stdout ${params.url}`;
    const result = await execSecure(cmd, { timeout: 60000 });
    return JSON.parse(result.stdout);
  },
};
```

## Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| url | string | yes |; | Target URL |
| aggression | number | no | 3 | 1=passive, 2=polite, 3=aggressive, 4=heavy |

## Structured Output
```json
{
  "target": "https://example.com",
  "plugins": {
    "WordPress": { "version": ["6.4.2"] },
    "nginx": { "version": ["1.24.0"] },
    "jQuery": { "version": ["3.7.1"] },
    "Google Analytics": { "string": ["UA-12345678-1"] },
    "CloudFlare": { "string": ["Cloudflare"] }
  }
}
```

## Workflow Chains
```
UPSTREAM:   01-nmap (web ports)
DOWNSTREAM: 14-wpscan (if WordPress detected), 11-nuclei (tech-specific templates)
```

## Pitfalls
1. **Aggression 4 generates heavy traffic**; 100+ requests per page
2. **JavaScript**; doesn't execute JS; misses React/Angular versions
3. **False matches**; some plugins have overlapping regex patterns

## Verification
```bash
which whatweb
whatweb -a 1 https://example.com
```
