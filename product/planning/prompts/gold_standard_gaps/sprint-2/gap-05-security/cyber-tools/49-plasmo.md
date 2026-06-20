# Tool: plasmo | #49 | Evidence Collector

## Metadata
- **Priority:** HIGH; **Source:** CSI; **Binary:** `plaso` (log2timeline.py); **Package:** `plaso`
- **Risk:** low; **Approval:** no; **OS:** csi, kali

## Purpose
Next-gen log2timeline with `psteal` for automated super-timeline creation. Aggregates timestamps from filesystem, registry, event logs, browser history, and 100+ artifact sources into a single unified timeline.

## Carina CLI Command
```
carina forensic timeline <image> --engine plaso [--parsers winreg,esedb,lnk]
```

## TypeScript Wrapper

```typescript
export const plasoTool: ToolDefinition = {
  name: 'plaso_timeline',
  description: 'Super timeline; aggregates 100+ artifact sources.',
  parameters: {
    image: { type: 'string', required: true },
    outputFile: { type: 'string', required: true },
    parsers: { type: 'array', items: 'string' },
    partition: { type: 'number' },
  },
  requires: ['log2timeline.py'],
  risk: 'low',
  category: 'forensic',
  handler: async (params, ctx) => {
    const partFlag = params.partition ? `--partitions ${params.partition}` : '--partitions all';
    const parserFlag = params.parsers ? `--parsers ${params.parsers.join(',')}` : '';
    const cmd = `psteal.py --source ${params.image} ${partFlag} ${parserFlag} -w ${params.outputFile}`;
    await execSecure(cmd, { timeout: 3600000 });
    return { timeline: params.outputFile, events: await getEventCount(params.outputFile) };
  },
};
```

## Pitfalls
1. **Massive output**; super timelines can be 100GB+; filter aggressively
2. **Parser errors**; individual parsers can fail without stopping collection

## Verification
```bash
which psteal.py && psteal.py --version
```
