# Tool: volatility3 | #39 | Memory Forensics

## Metadata
- **Priority:** CRITICAL; **Source:** CSI/Kali; **Binary:** `vol` (volatility3); **Package:** `volatility3`
- **Risk:** low; **Approval:** no; **OS:** kali, parrot, csi

## Purpose
Memory forensics framework (v3). Analyzes RAM dumps to extract running processes, network connections, registry keys, loaded DLLs, command history, injected code, and malware artifacts. Carina uses Volatility3 for automated memory analysis in incident response and malware investigations.

## Carina CLI Command
```
carina forensic memory <dump> [--profile auto|win10|linux|mac] [--plugins pslist,netscan,malfind,...]
```

## TypeScript Wrapper

```typescript
export const volatilityTool: ToolDefinition = {
  name: 'volatility_analyze',
  description: 'Memory forensics; processes, network, registry, DLLs, malware artifacts from RAM dumps.',
  parameters: {
    dump: { type: 'string', description: 'Memory dump file (raw, crash, vmss, vmem)', required: true },
    profile: { type: 'string', description: 'OS profile (auto-detect if omitted)' },
    plugins: { type: 'array', items: 'string', description: 'Plugins to run', default: ['windows.info','windows.pslist','windows.netscan','windows.malfind','windows.cmdline','windows.dlllist','windows.registry.hivelist'] },
    outputDir: { type: 'string', description: 'Output directory for extracted files' },
    dumpPids: { type: 'array', items: 'number', description: 'Process PIDs to dump' },
  },
  requires: ['volatility3'],
  risk: 'low',
  category: 'forensic',
  handler: async (params, ctx) => {
    const outDirFlag = params.outputDir ? `-o ${params.outputDir}` : `-o /tmp/vol_${Date.now()}`;
    const profileFlag = params.profile ? '' : ''; // v3 auto-detects
    const results = {};
    for (const plugin of params.plugins) {
      const cmd = `vol -f ${params.dump} ${outDirFlag} ${plugin}`;
      const result = await execSecure(cmd, { timeout: 300000 });
      results[plugin] = parseVolOutput(result.stdout);
    }
    // Dump specific processes if requested
    if (params.dumpPids) {
      for (const pid of params.dumpPids) {
        await execSecure(`vol -f ${params.dump} ${outDirFlag} windows.dumpfiles --pid ${pid}`);
      }
    }
    return { profile: results['windows.info'], results };
  },
};
```

## Key Plugins
| Plugin | Output |
|--------|--------|
| windows.info | OS version, kernel, time |
| windows.pslist | Running processes |
| windows.netscan | Network connections (TCP/UDP) |
| windows.malfind | Injected code / hollowed processes |
| windows.cmdline | Process command lines |
| windows.dlllist | Loaded DLLs per process |
| windows.registry.hivelist | Registry hives in memory |
| windows.registry.printkey | Registry key contents |
| windows.filescan | File objects in memory |
| windows.psscan | Hidden/unlinked processes |
| linux.pslist | Linux processes |
| mac.pslist | macOS processes |

## Workflow Chains
```
UPSTREAM:   38-autopsy (disk image → extract hiberfil/memdump)
DOWNSTREAM: 45-yara (scan dumped processes for malware)
```

## Pitfalls
1. **Profile accuracy**; v3 auto-detects but can fail on custom kernels
2. **Dump format**; needs raw format; convert vmss with vmss2core
3. **Large dumps**; 64GB+ RAM dumps can take hours per plugin
4. **Symbol tables**; Linux profiles need matching kernel symbol tables

## Verification
```bash
which vol && vol --version
vol -f /dev/null windows.info 2>&1 | head -5
```
