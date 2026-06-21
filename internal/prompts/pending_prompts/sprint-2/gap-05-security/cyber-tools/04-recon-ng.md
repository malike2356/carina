# Tool: recon-ng | #04 | OSINT Framework


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
- **Binary:** `recon-ng`
- **Package:** `recon-ng`
- **Risk Level:** low
- **Requires Human Approval:** no
- **OS Compatibility:** kali, parrot

## Purpose
Web reconnaissance framework with 100+ modules organized into discovery, reporting, exploitation, and expansion phases. Recon-ng provides a structured workflow for OSINT gathering with a database backend; perfect for agent-driven orchestration. Modules cover: contacts, hosts, ports, vulnerabilities, credentials, companies, and locations.

## Carina CLI Command
```
carina recon framework <domain> [--modules discovery|reporting|all] [--workspace <name>]
```

## TypeScript Wrapper

```typescript
export const reconNgTool: ToolDefinition = {
  name: 'reconng_gather',
  description: 'Structured OSINT framework; 100+ modules, database-backed, workspace isolation.',
  parameters: {
    domain:      { type: 'string', description: 'Target domain', required: true },
    modules:     { type: 'enum', values: ['discovery', 'reporting', 'expansion', 'all'], default: 'discovery' },
    workspace:   { type: 'string', description: 'Workspace name for result isolation', required: false },
    moduleList:  { type: 'array', items: 'string', description: 'Specific modules to run', required: false },
  },
  requires: ['recon-ng'],
  risk: 'low',
  category: 'recon',
  handler: async (params, ctx) => {
    const ws = params.workspace || `carina_${params.domain}_${Date.now()}`;
    let cmd = `recon-ng -w ${ws}`;
    cmd += ` -m "modules load ${params.modules}"`;
    cmd += ` -c "db insert domains ${params.domain}"`;
    if (params.moduleList) {
      for (const m of params.moduleList) cmd += ` -m "${m}"`;
    }
    const result = await execSecure(cmd, { timeout: 300000 });
    const report = await execSecure(`recon-ng -w ${ws} -c "show hosts; show contacts; show credentials"`);
    return parseReconNgOutput(report.stdout);
  },
};
```

## Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| domain | string | yes |; | Target domain |
| modules | enum | no | discovery | discovery/reporting/expansion/all |
| workspace | string | no | auto | Workspace name for isolation |
| moduleList | array | no |; | Specific modules to run |

## Key Modules
- `discovery/info_disclosure/cache_snoop`; Cache snooping
- `discovery/info_disclosure/interesting_files`; Interesting files
- `reporting/list/hosts`; Host enumeration
- `recon/hosts-hosts/bing_domain_web`; Bing domain search
- `recon/contacts-contacts/mailtester`; Email verification
- `discovery/dns/dns_brute`; DNS brute force
- `reporting/csv`; CSV export

## Workflow Chains
```
UPSTREAM:   03-theHarvester (emails, hosts)
DOWNSTREAM: 05-spiderfoot (automated OSINT), 07-maltego (graph)
```

## Pitfalls
1. **Module dependencies**; some modules need API keys; check `keys list` first
2. **Database grows**; workspaces accumulate data; clean up after engagement
3. **Module errors**; individual modules can fail silently; check `show` for completeness
4. **Rate limiting**; rapid module execution triggers source blocks; stagger runs
5. **Python2**; recon-ng may require Python 2 in some distros

## Verification
```bash
which recon-ng
recon-ng --help | head -20
recon-ng -w test -c "modules search"
```
