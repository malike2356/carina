# Tool: rekall | #47 | Memory Forensics (Alternative)


## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`

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
