# Tool: ettercap | #37 | MITM Attack Suite

## Metadata
- **Priority:** MEDIUM; **Source:** Kali; **Binary:** `ettercap`; **Package:** `ettercap-text-only`
- **Risk:** high; **Approval:** yes; **OS:** kali, parrot

## Purpose
Classic MITM attack suite. ARP poisoning, DHCP spoofing, ICMP redirect, port stealing, and credential sniffing for 30+ protocols (HTTP, FTP, Telnet, SMTP, IMAP, POP3, SMB, MySQL). Carina uses ettercap as a lightweight alternative to bettercap for targeted credential harvesting.

## Carina CLI Command
```
carina wireless mitm --engine ettercap <interface> [--target <IP>] [--sniff]
```

## TypeScript Wrapper

```typescript
export const ettercapTool: ToolDefinition = {
  name: 'ettercap_mitm',
  description: 'Classic MITM; ARP poisoning, credential sniffing for 30+ protocols.',
  parameters: {
    interface: { type: 'string', required: true },
    target1: { type: 'string', description: 'Target 1 (e.g., /192.168.1.5/)' },
    target2: { type: 'string', description: 'Target 2 (e.g., /192.168.1.1/)' },
    mitm: { type: 'enum', values: ['arp:remote', 'icmp', 'dhcp', 'port'], default: 'arp:remote' },
    sniff: { type: 'boolean', default: true },
    filter: { type: 'string', description: 'Ettercap filter (.ef file)' },
  },
  requires: ['ettercap'],
  risk: 'high',
  category: 'wireless',
  requiresApproval: true,
  handler: async (params, ctx) => {
    await ctx.requestApproval('MITM attack via ettercap');
    const tFlag = params.target1 && params.target2 ? `-T -M ${params.mitm} ${params.target1} ${params.target2}` : '';
    const sniffFlag = params.sniff ? '-q' : '';
    const filterFlag = params.filter ? `-F ${params.filter}` : '';
    const cmd = `ettercap -i ${params.interface} ${tFlag} ${sniffFlag} ${filterFlag} -P autoadd -w /tmp/ettercap_${Date.now()}.pcap`;
    const result = await execSecure(cmd, { timeout: 300000 });
    return { output: result.stdout, pcap: `/tmp/ettercap_*.pcap` };
  },
};
```

## Sniffed Protocols
HTTP, FTP, Telnet, SMTP, IMAP, POP3, SMB, MySQL, PostgreSQL, LDAP, SNMP, NNTP, IRC, VNC, RDP, SOCKS, DHCP, RADIUS

## Pitfalls
1. **Bettercap supersedes**; bettercap is more modern; use ettercap for legacy compatibility
2. **Text-only mode**; use `-T` for terminal mode; GUI is `ettercap -G`
3. **Filter complexity**; .ef filters use a unique syntax; test before deploying

## Verification
```bash
which ettercap && ettercap -v
```
