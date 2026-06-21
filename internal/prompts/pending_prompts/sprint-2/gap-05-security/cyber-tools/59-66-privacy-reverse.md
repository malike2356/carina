# Tool: anonsurf | #59 | Anonymous Routing via Tor

**Source:** Parrot | **Binary:** `anonsurf` | **Package:** `anonsurf` | **Risk:** medium | **OS:** parrot, kali

Routes all system traffic through Tor for anonymous operations. Changes IP periodically. Carina activates anonsurf before reconnaissance against sensitive targets.

## CLI: `carina privacy tor <on|off|status|change>`

## Wrapper
```typescript
export const anonsurfTool: ToolDefinition = {
  name: 'anonsurf_tor',
  description: 'Route all traffic through Tor; anonymous IP, periodic rotation.',
  parameters: {
    action: { type: 'enum', values: ['start','stop','status','change','restart'], required: true },
  },
  requires: ['anonsurf'],
  risk: 'medium',
  category: 'privacy',
  handler: async (params, ctx) => {
    const result = await execSecure(`anonsurf ${params.action}`, { timeout: 30000 });
    if (params.action === 'status') return { torActive: result.stdout.includes('active') };
    return { torStatus: params.action };
  },
};
```

Pitfalls: Slows connection; some services block Tor; `change` gets new exit node.
Verify: `which anonsurf`

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`

# Tool: tor | #60 | Anonymity Network Daemon

**Source:** Parrot | **Binary:** `tor` | **Package:** `tor` | **Risk:** low

SOCKS5 proxy via Tor network. Carina configures tools to proxy through Tor (`socks5://127.0.0.1:9050`).

## CLI: `carina privacy proxy <command> --via-tor`

## Wrapper
```typescript
export const torProxyTool: ToolDefinition = {
  name: 'tor_proxy',
  description: 'Execute any tool through Tor SOCKS5 proxy.',
  parameters: {
    command: { type: 'string', required: true },
    socksPort: { type: 'number', default: 9050 },
  },
  requires: ['tor'],
  risk: 'low',
  category: 'privacy',
  handler: async (params, ctx) => {
    const cmd = `torify ${params.command}`;
    const result = await execSecure(cmd, { timeout: 300000 });
    return { output: result.stdout, viaTor: true };
  },
};
```

Verify: `which tor && systemctl status tor 2>/dev/null || echo "tor not running"`

---
# Tool: mat2 | #61 | Metadata Anonymization

**Source:** Parrot | **Binary:** `mat2` | **Package:** `mat2` | **Risk:** low | **Approval:** no

Metadata Anonymization Toolkit. Strips EXIF, geolocation, author, and other metadata from files before sharing. Supports images, PDFs, Office docs, audio, and video.

## CLI: `carina privacy strip <file|dir> [--recursive] [--lightweight]`

## Wrapper
```typescript
export const mat2Tool: ToolDefinition = {
  name: 'mat2_strip',
  description: 'Remove metadata/EXIF from files; images, PDFs, Office, audio, video.',
  parameters: {
    target: { type: 'string', required: true },
    recursive: { type: 'boolean', default: false },
    lightweight: { type: 'boolean', default: false, description: 'Keep file size small' },
  },
  requires: ['mat2'],
  risk: 'low',
  category: 'privacy',
  handler: async (params, ctx) => {
    const rFlag = params.recursive ? '-r' : '';
    const lFlag = params.lightweight ? '--lightweight' : '';
    const cmd = `mat2 ${rFlag} ${lFlag} ${params.target}`;
    const result = await execSecure(cmd, { timeout: 300000 });
    return { target: params.target, stripped: true, output: result.stdout };
  },
};
```

Verify: `which mat2`

---
# Tool: bleachbit | #62 | System Cleaner / Anti-Forensics

**Source:** Parrot | **Binary:** `bleachbit` | **Package:** `bleachbit` | **Risk:** low

Secure file deletion and system cleaning. Overwrites files before deletion to prevent forensic recovery. Cleans browser history, cache, logs, and temporary files.

## CLI: `carina privacy clean [--deep] [--presets browser,system,logs]`

## Wrapper
```typescript
export const bleachbitTool: ToolDefinition = {
  name: 'bleachbit_clean',
  description: 'Secure deletion; overwrite files, clean browser/logs/temp.',
  parameters: {
    presets: { type: 'array', items: 'string', default: ['firefox','chrome','system','tmp'] },
    deep: { type: 'boolean', default: false, description: 'Deep scan (slower, more thorough)' },
  },
  requires: ['bleachbit'],
  risk: 'low',
  category: 'privacy',
  handler: async (params, ctx) => {
    const pFlag = params.presets.map(p => `--preset ${p}`).join(' ');
    const cmd = `bleachbit --clean ${pFlag}`;
    await execSecure(cmd, { timeout: 600000 });
    return { cleaned: params.presets, timestamp: new Date().toISOString() };
  },
};
```

Verify: `which bleachbit`

---
# Tool: gparted | #63 | Disk Partition Editor

**Source:** Parrot | **Binary:** `gparted` (CLI: `parted`) | **Package:** `gparted` | **Risk:** high | **Approval:** yes

GUI partition editor; CLI via `parted`. Carina uses it for creating forensic storage volumes and partitioning evidence drives.

## CLI: `carina forensic disk setup <device> [--partition-table gpt|msdos] [--label <name>]`

## Wrapper
```typescript
export const partedTool: ToolDefinition = {
  name: 'parted_setup',
  description: 'Disk partitioning for forensic storage volumes.',
  parameters: {
    device: { type: 'string', required: true },
    table: { type: 'enum', values: ['gpt', 'msdos'], default: 'gpt' },
    label: { type: 'string' },
  },
  requires: ['parted'],
  risk: 'high',
  category: 'forensic',
  requiresApproval: true,
  handler: async (params, ctx) => {
    await ctx.requestApproval(`Partitioning ${params.device}; all data will be destroyed`);
    await execSecure(`parted ${params.device} mklabel ${params.table}`);
    await execSecure(`parted ${params.device} mkpart primary ext4 0% 100%`);
    return { device: params.device, table: params.table, status: 'partitioned' };
  },
};
```

Pitfalls: Destroys all data on device; always verify you have the correct `/dev/sdX`.
Verify: `which parted && parted --version`

---
# Tool: radare2 | #64 | Reverse Engineering Framework

**Source:** Parrot | **Binary:** `r2` | **Package:** `radare2` | **Risk:** low | **OS:** all

Unix-like reverse engineering framework. Disassembly, debugging, binary patching, and analysis. Lighter than Ghidra, scriptable via r2pipe. Carina uses it for rapid binary triage.

## CLI: `carina forensic reverse <binary> --engine radare2 [--analyze] [--strings] [--functions]`

## Wrapper
```typescript
export const radare2Tool: ToolDefinition = {
  name: 'radare2_analyze',
  description: 'RE framework; disassembly, debugging, binary analysis, scripting via r2pipe.',
  parameters: {
    binary: { type: 'string', required: true },
    commands: { type: 'array', items: 'string', default: ['aaa','afl','izz','iE'] },
  },
  requires: ['radare2'],
  risk: 'low',
  category: 'reverse',
  handler: async (params, ctx) => {
    const cmds = params.commands.join(';');
    const result = await execSecure(`r2 -q -c '${cmds}' ${params.binary}`, { timeout: 300000 });
    return parseR2Output(result.stdout);
  },
};
```

Key Commands: `aaa` (auto-analyze), `afl` (list functions), `izz` (strings), `iE` (exports), `pdc` (decompile)

---
# Tool: cutter | #65 | RE Platform (GUI)

**Source:** Parrot | **Binary:** `cutter` | **Package:** `cutter` | **Risk:** low

Graphical frontend for radare2. Carina CLI mode integrates with Cutter's analysis engine.

CLI: `carina forensic reverse <binary> --engine cutter [--export decompile|graph|report]`

Wrapper: Delegates to radare2 under the hood. `cutter --script <script.py> <binary>`

Verify: `which cutter`.

---
# Tool: vscodium | #66 | Security-Focused IDE

**Source:** Parrot | **Binary:** `codium` | **Package:** `codium` | **Risk:** low

VS Code without Microsoft telemetry. Carina configures Codium as the default code editor for exploit development and forensic script authoring.

CLI: `codium <file>`; Launch editor. Carina uses it for interactive code editing when operator requests.

Verify: `which codium`
