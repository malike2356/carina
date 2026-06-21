# Tool: xplico | #50 | Network Forensics

## Metadata
- **Priority:** HIGH; **Source:** CSI; **Binary:** `xplico`; **Package:** `xplico`
- **Risk:** low; **Approval:** no; **OS:** csi

## Purpose
Network forensics analysis tool. Extracts application-layer data from pcap files; reconstructs emails, HTTP content, VoIP calls, FTP transfers, IM chats, and social media activity from captured traffic.

## Carina CLI Command
```
carina forensic pcap <file> --engine xplico [--decode http|smtp|ftp|voip|all]
```

## TypeScript Wrapper

```typescript
export const xplicoTool: ToolDefinition = {
  name: 'xplico_decode',
  description: 'Network forensics; reconstruct emails, HTTP, VoIP, chats from pcap.',
  parameters: {
    pcap: { type: 'string', required: true },
    decode: { type: 'array', items: 'string', default: ['all'] },
    outputDir: { type: 'string', required: true },
  },
  requires: ['xplico'],
  risk: 'low',
  category: 'forensic',
  handler: async (params, ctx) => {
    const cmd = `xplico -m pcap -f ${params.pcap} -o ${params.outputDir}`;
    await execSecure(cmd, { timeout: 1800000 });
    return { outputDir: params.outputDir };
  },
};
```

## Pitfalls
1. **Encrypted traffic**; HTTPS/TLS traffic not decodable without keys
2. **Apache web server**; xplico typically runs as web app; CLI mode is limited

## Verification
```bash
which xplico
```

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`

# Tool: regripper | #51 | Windows Registry Forensics

## Metadata
- **Priority:** HIGH; **Source:** CSI/Kali; **Binary:** `rip`; **Package:** `regripper`
- **Risk:** low; **Approval:** no; **OS:** kali, csi

## Purpose
Windows registry forensics. Parses registry hives (SAM, SYSTEM, SOFTWARE, NTUSER.DAT) to extract user activity, installed software, USB history, network configs, and malware persistence mechanisms.

## Carina CLI Command
```
carina forensic registry <hive> [--plugin all|usbstor|run|networklist|userassist]
```

## TypeScript Wrapper

```typescript
export const regripperTool: ToolDefinition = {
  name: 'regripper_analyze',
  description: 'Registry forensics; USB, persistence, network, user activity from hives.',
  parameters: {
    hive: { type: 'string', required: true },
    plugins: { type: 'array', items: 'string', default: ['all'] },
    outputFile: { type: 'string' },
  },
  requires: ['regripper'],
  risk: 'low',
  category: 'forensic',
  handler: async (params, ctx) => {
    const out = params.outputFile || '/dev/stdout';
    const pFlag = params.plugins.includes('all') ? '-a' : `-p ${params.plugins.join(' ')}`;
    const result = await execSecure(`rip -r ${params.hive} ${pFlag} > ${out}`, { timeout: 300000 });
    return { hive: params.hive, output: result.stdout };
  },
};
```

## Key Plugins
`usbstor` (USB history), `run` (autorun persistence), `networklist` (WiFi networks), `userassist` (program execution), `shellbags` (folder access), `typedurls` (IE history), `appcompatcache` (execution artifacts)

## Pitfalls
1. **Hive locking**; copy hives from mounted image; never analyze live registry
2. **Encrypted hives**; SAM/SYSTEM must come from same machine

## Verification
```bash
which rip
rip -l | head -20
```

---
# Tool: hashdeep | #52 | Hash Set Verification

## Metadata
- **Priority:** HIGH; **Source:** CSI; **Binary:** `hashdeep`; **Package:** `hashdeep`
- **Risk:** low; **Approval:** no; **OS:** kali, csi

## Purpose
Compute and audit cryptographic hashes across directory trees. Generates hash sets for evidence integrity verification and compares against known-good hash sets (NSRL, ProjectVIC). Carina uses hashdeep for evidence verification and known-file filtering.

## Carina CLI Command
```
carina forensic hash <dir> [--compare <hashset>] [--algo md5|sha1|sha256]
```

## TypeScript Wrapper

```typescript
export const hashdeepTool: ToolDefinition = {
  name: 'hashdeep_audit',
  description: 'Hash set generation and verification; MD5, SHA-1, SHA-256.',
  parameters: {
    directory: { type: 'string', required: true },
    algorithm: { type: 'enum', values: ['md5', 'sha1', 'sha256'], default: 'sha256' },
    compare: { type: 'string', description: 'Hash set to compare against (NSRL)' },
    outputFile: { type: 'string' },
  },
  requires: ['hashdeep'],
  risk: 'low',
  category: 'forensic',
  handler: async (params, ctx) => {
    const out = params.outputFile || `/tmp/hashdeep_${Date.now()}.txt`;
    const compFlag = params.compare ? `-k ${params.compare}` : '';
    const cmd = `hashdeep -c ${params.algorithm} -r ${compFlag} ${params.directory} > ${out}`;
    await execSecure(cmd, { timeout: 3600000 });
    return { hashFile: out, algorithm: params.algorithm };
  },
};
```

## Pitfalls
1. **Large trees**; scanning millions of files takes hours
2. **NSRL outdated**; known-good hash sets need regular updates

## Verification
```bash
which hashdeep && hashdeep -V
```

---
# Tool: ollydbg | #53 | Windows Debugger

## Metadata
- **Priority:** MEDIUM; **Source:** Kali; **Binary:** `ollydbg`; **Package:** `ollydbg`
- **Risk:** medium; **Approval:** no; **OS:** kali (needs Wine for Windows binary analysis)

## Purpose
Windows 32-bit ring-3 debugger for binary analysis. Trace execution, set breakpoints, patch code, and analyze malware behavior. Carina uses OllyDbg within Wine for automated malware behavior analysis.

## Carina CLI Command
```
carina forensic debug <binary> --engine ollydbg [--script <file>]
```

## TypeScript Wrapper

```typescript
export const ollydbgTool: ToolDefinition = {
  name: 'ollydbg_analyze',
  description: 'Windows debugger; trace execution, breakpoints, patch code, malware analysis.',
  parameters: {
    binary: { type: 'string', required: true },
    script: { type: 'string', description: 'OllyScript for automation' },
    timeout: { type: 'number', default: 300 },
  },
  requires: ['wine', 'ollydbg'],
  risk: 'medium',
  category: 'forensic',
  handler: async (params, ctx) => {
    const cmd = params.script ? `wine ollydbg.exe /r ${params.script} ${params.binary}` : `wine ollydbg.exe ${params.binary}`;
    const result = await execSecure(cmd, { timeout: params.timeout * 1000 || 300000 });
    return { binary: params.binary, output: result.stdout };
  },
};
```

## Pitfalls
1. **Wine dependency**; needs Wine on Linux; native Windows preferred
2. **32-bit only**; cannot analyze 64-bit binaries
3. **Automation limited**; ODBGScript is less robust than x64dbg scripting

## Verification
```bash
which wine && ls /opt/ollydbg/ollydbg.exe 2>/dev/null
```
