# Tool: legion | #17 | Network Pentesting Framework


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
- **Binary:** `legion`
- **Package:** `legion`
- **Risk Level:** medium
- **Requires Human Approval:** no
- **OS Compatibility:** kali, parrot

## Purpose
Semi-automated network penetration testing framework (fork of Sparta). Combines nmap scanning, service enumeration, screenshot capture, and brute forcing into a workflow-driven console. Carina uses Legion's headless API for automated network assessment.

## Carina CLI Command
```
carina vuln assess <target> [--ports top1000|all|custom] [--brute] [--screenshots]
```

## TypeScript Wrapper

```typescript
export const legionTool: ToolDefinition = {
  name: 'legion_assess',
  description: 'Automated network pentest; nmap + service enum + brute force + screenshots.',
  parameters: {
    target:     { type: 'string', description: 'IP or CIDR range', required: true },
    ports:      { type: 'enum', values: ['top1000','all','custom'], default: 'top1000' },
    brute:      { type: 'boolean', default: false, description: 'Enable brute forcing' },
    screenshots:{ type: 'boolean', default: true, description: 'Capture web service screenshots' },
  },
  requires: ['legion'],
  risk: 'medium',
  category: 'vuln',
  handler: async (params, ctx) => {
    const cmd = `legion --target ${params.target} --ports ${params.ports} --headless --json /dev/stdout` +
      `${params.brute ? ' --brute' : ''}${params.screenshots ? ' --screenshots' : ''}`;
    const result = await execSecure(cmd, { timeout: 600000 });
    return JSON.parse(result.stdout);
  },
};
```

## Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| target | string | yes |; | IP or CIDR |
| ports | enum | no | top1000 | Port range |
| brute | boolean | no | false | Brute force services |
| screenshots | boolean | no | true | Web screenshots |

## Workflow Chains
```
UPSTREAM:   01-nmap (initial scan; legion wraps nmap internally)
DOWNSTREAM: 11-nuclei (vuln scan web services), 18-metasploit (exploitation)
```

## Pitfalls
1. **Java dependency**; requires Java runtime for headless browser
2. **Resource intensive**; screenshot capture spawns headless Chromium
3. **Limited stealth**; aggressive scanning is easily detected
4. **Legacy codebase**; fork of deprecated Sparta; less maintained than dedicated tools

## Verification
```bash
which legion
legion --version
```
