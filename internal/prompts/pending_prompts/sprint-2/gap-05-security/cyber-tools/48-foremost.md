# Tool: foremost | #48 | File Carving


## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`

## Metadata
- **Priority:** HIGH; **Source:** CSI/Kali; **Binary:** `foremost`; **Package:** `foremost`
- **Risk:** low; **Approval:** no; **OS:** kali, csi

## Purpose
File carving tool. Recovers deleted files from disk images by searching for file headers/footers (magic bytes); independent of file system metadata. Supports jpg, png, gif, pdf, doc, xls, ppt, zip, exe, and more. Carina uses foremost when TSK can't recover files via filesystem.

## Carina CLI Command
```
carina forensic carve <image> [--types all|jpg,png,pdf,doc] [--output <dir>]
```

## TypeScript Wrapper

```typescript
export const foremostTool: ToolDefinition = {
  name: 'foremost_carve',
  description: 'File carving; recover deleted files via header/footer signatures.',
  parameters: {
    image: { type: 'string', required: true },
    types: { type: 'array', items: 'string', default: ['all'] },
    outputDir: { type: 'string', required: true },
  },
  requires: ['foremost'],
  risk: 'low',
  category: 'forensic',
  handler: async (params, ctx) => {
    const tFlag = params.types.includes('all') ? '-t all' : `-t ${params.types.join(',')}`;
    const cmd = `foremost ${tFlag} -i ${params.image} -o ${params.outputDir}`;
    const result = await execSecure(cmd, { timeout: 3600000 });
    const audit = await readFile(`${params.outputDir}/audit.txt`);
    return { directory: params.outputDir, audit: audit.content };
  },
};
```

## Supported Types
`jpg`, `gif`, `png`, `bmp`, `avi`, `mov`, `mp4`, `pdf`, `doc`, `xls`, `ppt`, `zip`, `rar`, `exe`, `elf`, `ole`, `hfs`, `ntfs`, `fat`

## Pitfalls
1. **No filesystem recovery**; carved files lose original names and paths
2. **Fragment recovery**; foremost can't recover fragmented files
3. **False positives**; header matching can produce garbage files

## Verification
```bash
which foremost && foremost -V
foremost -t jpg,png -i /dev/null -o /tmp/test_carve
```
