# Tool: rekall | #47 | Memory Forensics (Alternative)

## Metadata
- **Priority:** HIGH; **Source:** CSI/Kali; **Binary:** `rekall`; **Package:** `rekall`
- **Risk:** low; **Approval:** no; **OS:** all (Python)

## Purpose
Memory analysis framework (Google-developed). Alternative to Volatility with profile repository, web console, and timeline integration. Carina uses Rekall when Volatility3 auto-profile fails.

## Carina CLI Command
```
carina forensic memory <dump> --engine rekall [--plugins pslist,netscan]
```

## TypeScript Wrapper

```typescript
export const rekallTool: ToolDefinition = {
  name: 'rekall_analyze',
  description: 'Memory forensics (Google); profiles, timeline, alternative to Volatility.',
  parameters: {
    dump: { type: 'string', required: true },
    plugins: { type: 'array', items: 'string', default: ['pslist','netscan','malfind','cmdline'] },
    profile: { type: 'string' },
    outputDir: { type: 'string' },
  },
  requires: ['rekall'],
  risk: 'low',
  category: 'forensic',
  handler: async (params, ctx) => {
    const outFlag = params.outputDir ? `--output_dir ${params.outputDir}` : '';
    const profileFlag = params.profile ? `--profile ${params.profile}` : '';
    let results = {};
    for (const p of params.plugins) {
      const r = await execSecure(`rekall -f ${params.dump} ${profileFlag} ${outFlag} ${p}`, { timeout: 300000 });
      results[p] = r.stdout;
    }
    return results;
  },
};
```

## Pitfalls
1. **Less maintained**; Volatility3 is more actively developed
2. **Profile format**; uses .json profiles, different from Volatility's ISF
3. **Python2 legacy**; some versions still require Python 2

## Verification
```bash
which rekall && rekall --version
```
