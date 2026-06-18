# Tool: sstimap | #32 | SSTI Detection & Exploitation

## Metadata
- **Priority:** MEDIUM; **Source:** Kali; **Binary:** `sstimap`
- **Package:** `sstimap` (git clone); **Risk:** high; **Approval:** yes; **OS:** any (Python)

## Purpose
Server-Side Template Injection (SSTI) detection and exploitation. Tests for SSTI in 10+ template engines (Jinja2, Twig, Freemarker, Velocity, Smarty, ERB, etc.) and can escalate to RCE when SSTI is confirmed.

## Carina CLI Command
```
carina vuln ssti <url> [--param <name>] [--engine auto|jinja2|twig|freemarker] [--os-shell]
```

## TypeScript Wrapper

```typescript
export const sstimapTool: ToolDefinition = {
  name: 'sstimap_test',
  description: 'SSTI detection + exploitation across 10+ template engines. RCE escalation available.',
  parameters: {
    url: { type: 'string', required: true },
    param: { type: 'string', description: 'Parameter to test' },
    data: { type: 'string', description: 'POST body' },
    cookie: { type: 'string' },
    engine: { type: 'string', default: 'auto' },
    osShell: { type: 'boolean', default: false, description: 'Attempt RCE via SSTI' },
  },
  requires: ['sstimap'],
  risk: 'high',
  category: 'web',
  requiresApproval: true,
  handler: async (params, ctx) => {
    if (params.osShell) await ctx.requestApproval('SSTI OS shell; will attempt RCE');
    const paramFlag = params.param ? `-p ${params.param}` : '';
    const dataFlag = params.data ? `--data '${params.data}'` : '';
    const cookieFlag = params.cookie ? `--cookie '${params.cookie}'` : '';
    const shellFlag = params.osShell ? '--os-shell' : '';
    const cmd = `sstimap -u ${params.url} ${paramFlag} ${dataFlag} ${cookieFlag} --engine ${params.engine || 'auto'} ${shellFlag}`;
    const result = await execSecure(cmd, { timeout: 120000 });
    return { url: params.url, engine: result.stdout.match(/Engine: (\\w+)/)?.[1], vulnerable: result.stdout.includes('vulnerable') };
  },
};
```

## Engines
Jinja2 (Python), Twig (PHP), Freemarker (Java), Velocity (Java), Smarty (PHP), ERB (Ruby), Tornado (Python), Mako (Python), Jade/Pug (Node), Nunjucks (Node)

## Pitfalls
1. **SSTI is rare**; don't lead with this; test after parameter discovery
2. **OS shell dangerous**; RCE in production is destructive; test in staging
3. **Engine detection**; auto-detection can misidentify; confirm manually

## Verification
```bash
test -d /opt/sstimap && python3 /opt/sstimap/sstimap.py -h
```
