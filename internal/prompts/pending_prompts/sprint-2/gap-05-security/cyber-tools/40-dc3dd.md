# Tool: dc3dd | #40 | Forensic Disk Imaging


## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`

## Metadata
- **Priority:** CRITICAL; **Source:** CSI; **Binary:** `dc3dd`; **Package:** `dc3dd`
- **Risk:** low; **Approval:** no; **OS:** kali, csi

## Purpose
DoD Cyber Crime Center patched version of dd. Creates forensically sound disk images with integrated hashing (MD5, SHA-1, SHA-256), progress reporting, error handling, and split output. Carina uses dc3dd for chain-of-custody disk imaging; every image is hashed, verified, and logged.

## Carina CLI Command
```
carina forensic image <device> [--output <file>] [--hash md5|sha1|sha256] [--split N]
```

## TypeScript Wrapper

```typescript
export const dc3ddTool: ToolDefinition = {
  name: 'dc3dd_image',
  description: 'Forensically sound disk imaging; DoD standard, integrated hashing, chain of custody.',
  parameters: {
    device: { type: 'string', description: 'Source device (e.g., /dev/sda)', required: true },
    output: { type: 'string', description: 'Output image path' },
    hash: { type: 'enum', values: ['md5', 'sha1', 'sha256', 'all'], default: 'all' },
    split: { type: 'number', description: 'Split into N GB chunks' },
    log: { type: 'string', description: 'Audit log file path' },
    errorLog: { type: 'string', description: 'Error log path' },
  },
  requires: ['dc3dd'],
  risk: 'low',
  category: 'forensic',
  handler: async (params, ctx) => {
    const out = params.output || `/mnt/evidence/${params.device.replace('/dev/', '')}_${new Date().toISOString().slice(0,10)}.dd`;
    const hashFlag = params.hash === 'all' ? 'hash=md5 hash=sha1 hash=sha256' : `hash=${params.hash}`;
    const splitFlag = params.split ? `split=${params.split}g` : '';
    const logFlag = params.log ? `log=${params.log}` : `log=/tmp/dc3dd_${Date.now()}.log`;
    const errFlag = params.errorLog ? `errlog=${params.errorLog}` : '';
    const cmd = `dc3dd if=${params.device} of=${out} ${hashFlag} ${splitFlag} ${logFlag} ${errFlag} verb=on`;
    const result = await execSecure(cmd, { timeout: 86400000 }); // 24h timeout for large disks
    return parseDc3ddLog(`${params.log || `/tmp/dc3dd_*.log`}`);
  },
};
```

## Chain of Custody Output
```json
{
  "source_device": "/dev/sda",
  "output_files": ["/mnt/evidence/sda_2026-06-17.dd"],
  "image_size": "512110190592 bytes (512 GB)",
  "hashes": {
    "md5": "d41d8cd98f00b204e9800998ecf8427e",
    "sha1": "da39a3ee5e6b4b0d3255bfef95601890afd80709",
    "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
  },
  "errors": 0,
  "duration_seconds": 1847,
  "examiner": "Carina Forensic Agent",
  "timestamp": "2026-06-17T14:30:00Z",
  "write_blocker": true
}
```

## Parameters
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| device | string |; | Source device |
| output | string | auto | Image path |
| hash | enum | all | Hash algorithms |
| split | number |; | Chunk size GB |
| log | string | auto | Audit log |
| errorLog | string |; | Error log |

## Workflow Chains
```
UPSTREAM:   (none; evidence acquisition start)
DOWNSTREAM: 38-autopsy (ingest image), 41-sleuthkit (file system analysis)
```

## Pitfalls
1. **Write blocker**; always use hardware write blocker when imaging suspect drives
2. **Disk size**; multi-TB drives take hours; use `split=` for manageable chunks
3. **Bad sectors**; dc3dd logs read errors without stopping; review error log
4. **Mount point**; never mount source before imaging; dd from block device only

## Verification
```bash
which dc3dd && dc3dd --version
dc3dd if=/dev/zero of=/tmp/test.dd count=10 hash=md5 log=/tmp/test.log
cat /tmp/test.log
```
