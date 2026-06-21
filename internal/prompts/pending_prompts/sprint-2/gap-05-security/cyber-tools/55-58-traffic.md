# Tool: tcpdump | #55 | Packet Capture

**Source:** Kali | **Binary:** `tcpdump` | **Package:** `tcpdump` | **Risk:** low | **Approval:** no

Command-line packet analyzer. Captures network traffic to pcap with BPF filtering. Carina pairs tcpdump for capture with tshark for analysis.

## CLI: `carina capture traffic <interface> [--filter "port 80"] [--count N] [--output <file>]`

## Wrapper
```typescript
export const tcpdumpTool: ToolDefinition = {
  name: 'tcpdump_capture',
  description: 'Packet capture with BPF filter; lightweight, fast, outputs pcap.',
  parameters: {
    interface: { type: 'string', required: true },
    filter: { type: 'string', description: 'BPF filter (e.g., "port 80", "host 10.0.0.5")' },
    count: { type: 'number', description: 'Packet count limit' },
    output: { type: 'string', description: 'Output pcap file' },
    snaplen: { type: 'number', default: 65535 },
  },
  requires: ['tcpdump'],
  risk: 'low',
  category: 'traffic',
  handler: async (params, ctx) => {
    const out = params.output || `/tmp/capture_${Date.now()}.pcap`;
    const f = [params.filter, params.count ? `-c ${params.count}` : '', `-s ${params.snaplen}`, `-w ${out}`, '-i', params.interface].filter(Boolean).join(' ');
    await execSecure(`tcpdump ${f}`, { timeout: 3600000 });
    return { pcap: out };
  },
};
```

Pitfalls: Needs root; BPF syntax differs from Wireshark display filter.
Verify: `which tcpdump && tcpdump --version`

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`

# Tool: dsniff | #56 | Network Auditing Toolkit

**Source:** Kali | **Binary:** `dsniff` | **Package:** `dsniff` | **Risk:** high | **Approval:** yes

Network auditing and penetration testing toolkit. Passively monitors for passwords, emails, and files sent across the network in cleartext protocols.

## CLI: `carina sniff creds <interface> [--protocols http,ftp,telnet,smtp]`

## Wrapper
```typescript
export const dsniffTool: ToolDefinition = {
  name: 'dsniff_capture',
  description: 'Network credential sniffer; HTTP, FTP, Telnet, SMTP, POP3, IMAP.',
  parameters: {
    interface: { type: 'string', required: true },
    protocols: { type: 'array', items: 'string' },
    outputFile: { type: 'string' },
  },
  requires: ['dsniff'],
  risk: 'high',
  category: 'traffic',
  requiresApproval: true,
  handler: async (params, ctx) => {
    await ctx.requestApproval('Passive credential sniffing on live network');
    const cmd = `dsniff -i ${params.interface} -w ${params.outputFile || '/tmp/dsniff_creds.txt'}`;
    const result = await execSecure(cmd, { timeout: 600000 });
    return { credentials: result.stdout };
  },
};
```

Pitfalls: Cleartext only; encrypted protocols (SSH, HTTPS) invisible; needs promiscuous mode.

---
# Tool: responder | #57 | LLMNR/NBT-NS/mDNS Poisoner

**Source:** Kali | **Binary:** `responder` | **Package:** `responder` | **Risk:** high | **Approval:** yes

LLMNR, NBT-NS, and mDNS poisoner. Responds to Windows name resolution requests to capture NTLMv2 hashes. Carina uses it for internal network credential harvesting.

## CLI: `carina exploit responder <interface> [--analyze] [--wpad]`

## Wrapper
```typescript
export const responderTool: ToolDefinition = {
  name: 'responder_poison',
  description: 'LLMNR/NBT-NS/mDNS poisoner; capture NTLMv2 hashes from Windows networks.',
  parameters: {
    interface: { type: 'string', required: true },
    analyze: { type: 'boolean', default: false, description: 'Passive analysis mode (no poisoning)' },
    wpad: { type: 'boolean', default: false, description: 'Enable WPAD proxy attack' },
  },
  requires: ['responder'],
  risk: 'high',
  category: 'exploit',
  requiresApproval: true,
  handler: async (params, ctx) => {
    await ctx.requestApproval('LLMNR/NBT-NS poisoning; will intercept network auth');
    const cmd = `responder -I ${params.interface} ${params.analyze ? '-A' : ''} ${params.wpad ? '-w' : ''}`;
    const result = await execSecure(cmd, { timeout: 600000 });
    const hashes = await readFile('/usr/share/responder/logs/Responder-Session.log');
    return { hashes: parseResponderLog(hashes.content) };
  },
};
```

Pitfalls: Extremely noisy; triggers every Windows security alert; use analyze mode for recon.

---
# Tool: scapy | #58 | Packet Manipulation

**Source:** Parrot | **Binary:** `scapy` (Python module) | **Package:** `scapy` | **Risk:** medium | **Approval:** no

Python-based packet manipulation engine. Craft, send, receive, and dissect packets at any layer. Carina uses Scapy for custom packet crafting, network scanning, and protocol fuzzing.

## CLI: `carina network craft <script.py> [--interface eth0]`

## Wrapper
```typescript
export const scapyTool: ToolDefinition = {
  name: 'scapy_craft',
  description: 'Packet crafting; build custom packets at any layer, fuzzing, scanning.',
  parameters: {
    script: { type: 'string', description: 'Python script using scapy', required: true },
    interface: { type: 'string' },
    count: { type: 'number', default: 1 },
  },
  requires: ['python3', 'scapy'],
  risk: 'medium',
  category: 'traffic',
  handler: async (params, ctx) => {
    const cmd = `python3 -c "from scapy.all import *; exec(open('${params.script}').read())"`;
    const result = await execSecure(cmd, { timeout: 300000 });
    return { output: result.stdout };
  },
};
```

Pitfalls: Raw sockets need root; packet crafting can trigger IDS; Python-only (not compiled).

Verify: `python3 -c "from scapy.all import *; print('OK')"`
