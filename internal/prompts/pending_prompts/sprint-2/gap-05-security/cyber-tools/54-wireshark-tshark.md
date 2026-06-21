# Tool: wireshark/tshark | #54 | Network Protocol Analyzer


## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`

## Metadata
- **Priority:** CRITICAL; **Source:** Kali/Parrot/CSI; **Binary:** `tshark`; **Package:** `wireshark` (tshark included)
- **Risk:** low; **Approval:** no; **OS:** all

## Purpose
World's most widely used network protocol analyzer. TShark is the CLI version; captures live traffic and analyzes pcap files with 3000+ protocol dissectors. Carina uses TShark for automated traffic analysis, protocol decoding, and threat detection from captured packets.

## Carina CLI Command
```
carina analyze pcap <file> [--filter "http or dns"] [--stats] [--conversations]
```

## TypeScript Wrapper

```typescript
export const tsharkTool: ToolDefinition = {
  name: 'tshark_analyze',
  description: 'Network protocol analyzer; 3000+ dissectors, live capture, pcap analysis.',
  parameters: {
    pcap: { type: 'string', description: 'pcap file to analyze', required: true },
    filter: { type: 'string', description: 'Display filter (e.g., "http", "dns", "tcp.port==443")' },
    fields: { type: 'array', items: 'string', description: 'Fields to extract' },
    stats: { type: 'boolean', default: false, description: 'Show protocol hierarchy stats' },
    conversations: { type: 'boolean', default: false, description: 'Show endpoint conversations' },
    outputFormat: { type: 'enum', values: ['json', 'text', 'fields'], default: 'json' },
  },
  requires: ['tshark'],
  risk: 'low',
  category: 'traffic',
  handler: async (params, ctx) => {
    const filterFlag = params.filter ? `-Y "${params.filter}"` : '';
    const fieldsFlag = params.fields ? `-T fields ${params.fields.map(f => `-e ${f}`).join(' ')}` : '-T json';
    const cmd = `tshark -r ${params.pcap} ${filterFlag} ${fieldsFlag}`;
    if (params.stats) cmd += ' -z io,phs';
    if (params.conversations) cmd += ' -z conv,tcp';
    const result = await execSecure(cmd, { timeout: 300000 });
    return params.outputFormat === 'json' ? JSON.parse(result.stdout) : result.stdout;
  },
};
```

## Key Filters
| Filter | Meaning |
|--------|---------|
| `http` | HTTP requests/responses |
| `dns` | DNS queries/responses |
| `tcp.port==443` | HTTPS traffic |
| `tcp.flags.syn==1 && tcp.flags.ack==0` | SYN scan detection |
| `ip.src==10.0.0.0/8` | Internal traffic |
| `http.request.method==POST` | POST requests |
| `dns.qry.name contains "exfil"` | Suspicious DNS |

## Pitfalls
1. **TShark vs tcpdump**; TShark for analysis, tcpdump for capture only
2. **Large pcaps**; multi-GB files consume RAM; use filters to reduce
3. **Display filter syntax**; different from capture filter; learn the difference
4. **Root for live capture**; needs root; file analysis does not

## Verification
```bash
which tshark && tshark --version
tshark -r /dev/null 2>&1 | head -3
```
