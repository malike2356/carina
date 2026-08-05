# Tool: sleuthkit | #41 | File System Forensics


## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`

## Metadata
- **Priority:** CRITICAL; **Source:** CSI/Kali; **Binary:** `fls`, `icat`, `istat`, `ils`, `mmls`, `fsstat`, `tsk_recover`; **Package:** `sleuthkit`
- **Risk:** low; **Approval:** no; **OS:** kali, csi

## Purpose
The Sleuth Kit (TSK); low-level file system forensics toolkit. Analyzes NTFS, FAT, ext, HFS+, APFS at the inode/block level. Carina uses TSK tools for deleted file recovery, file system timeline building, and extracting evidence that OS-level tools miss.

## Carina CLI Command
```
carina forensic ts <image> [--action list|recover|timeline|stat] [--inode N] [--type deleted|all]
```

## TypeScript Wrapper

```typescript
export const sleuthkitTool: ToolDefinition = {
  name: 'sleuthkit_analyze',
  description: 'File system forensics; inode/block analysis, deleted file recovery, timeline, carving.',
  parameters: {
    image: { type: 'string', required: true },
    action: { type: 'enum', values: ['list', 'recover', 'timeline', 'stat', 'mmls'], required: true },
    inode: { type: 'number', description: 'Inode to operate on' },
    offset: { type: 'number', description: 'Partition offset (from mmls)' },
    outputDir: { type: 'string', description: 'Recovery output directory' },
    fileType: { type: 'string', description: 'Filter by type (r=regular, d=directory, -=deleted)' },
  },
  requires: ['sleuthkit'],
  risk: 'low',
  category: 'forensic',
  handler: async (params, ctx) => {
    const offsetFlag = params.offset ? `-o ${params.offset}` : '';
    let cmd: string, result: any;
    switch (params.action) {
      case 'mmls':
        cmd = `mmls ${params.image}`;
        result = await execSecure(cmd, { timeout: 60000 });
        return parseMmls(result.stdout);
      case 'list':
        cmd = `fls -r -p ${offsetFlag} ${params.image}`;
        result = await execSecure(cmd, { timeout: 300000 });
        return parseFls(result.stdout);
      case 'recover':
        cmd = `tsk_recover ${offsetFlag} ${params.image} ${params.outputDir}`;
        result = await execSecure(cmd, { timeout: 3600000 });
        return { recovered_to: params.outputDir, files: result.stdout };
      case 'timeline':
        cmd = `fls -r -m / ${offsetFlag} ${params.image} > /tmp/bodyfile && mactime -b /tmp/bodyfile`;
        result = await execSecure(cmd, { timeout: 600000 });
        return parseTimeline(result.stdout);
      case 'stat':
        cmd = `istat ${offsetFlag} ${params.image} ${params.inode}`;
        result = await execSecure(cmd);
        return { inode: params.inode, details: result.stdout };
    }
  },
};
```

## TSK Tools
| Tool | Purpose |
|------|---------|
| mmls | Partition layout |
| fsstat | File system details |
| fls | List files (including deleted) |
| icat | Extract file by inode |
| istat | Inode metadata |
| ils | List all inodes |
| tsk_recover | Recover all files |
| mactime | Build timeline from body file |

## Workflow Chains
```
UPSTREAM:   40-dc3dd (forensic image)
DOWNSTREAM: 42-binwalk (firmware extraction), 44-bulk-extractor (data carving)
CHAINS:     mmls → fls (deleted files) → icat (recover specific file)
```

## Pitfalls
1. **Partition offsets**; always run mmls first to find correct offset
2. **APFS limited**; APFS support is less mature than NTFS/ext4
3. **Encrypted volumes**; BitLocker/FileVault need decryption before TSK analysis
4. **Time zone**; mactime needs correct timezone offset

## Verification
```bash
which fls && fls -V
mmls /dev/null 2>&1 | head -3
```
