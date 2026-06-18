# Tool: yersinia | #16 | Layer 2 Attack Framework

## Metadata
- **Priority:** MEDIUM
- **Source:** Kali Linux
- **Binary:** `yersinia`
- **Package:** `yersinia`
- **Risk Level:** high
- **Requires Human Approval:** yes (network disruption)
- **OS Compatibility:** kali, parrot

## Purpose
Layer 2 network protocol attack framework. Tests vulnerabilities in STP, CDP, DTP, DHCP, HSRP, VTP, and 802.1q/802.1x protocols. Used for internal network security assessments and switch security testing.

## Carina CLI Command
```
carina vuln layer2 <interface> [--protocol stp|cdp|dtp|dhcp|hsrp|vtp|dot1x|all] [--mode attack|discover]
```

## TypeScript Wrapper

```typescript
export const yersiniaTool: ToolDefinition = {
  name: 'yersinia_attack',
  description: 'Layer 2 attack framework; STP, CDP, DTP, DHCP, HSRP, VTP, 802.1x.',
  parameters: {
    interface: { type: 'string', description: 'Network interface', required: true },
    protocol:  { type: 'array', items: 'string', description: 'Protocols to test', default: ['all'] },
    mode:      { type: 'enum', values: ['attack', 'discover'], default: 'discover' },
  },
  requires: ['yersinia'],
  risk: 'high',
  category: 'vuln',
  requiresApproval: true,
  handler: async (params, ctx) => {
    await ctx.requestApproval('L2 attack may disrupt network connectivity');
    const protoFlag = params.protocol.includes('all') ? '' : `-${params.protocol.join(' -')}`;
    const modeFlag = params.mode === 'discover' ? '-D' : '-G';
    const cmd = `yersinia ${params.mode} -I ${params.interface} ${protoFlag}`;
    const result = await execSecure(cmd, { timeout: 120000 });
    return { output: result.stdout, protocol: params.protocol, mode: params.mode };
  },
};
```

## Protocols
| Protocol | Attack | Impact |
|----------|--------|--------|
| STP | Root bridge claiming | VLAN-wide disruption |
| CDP | Fake neighbor injection | Information disclosure |
| DTP | Trunk negotiation | VLAN hopping |
| DHCP | Starvation / rogue server | IP exhaustion, MITM |
| HSRP | Priority manipulation | Gateway takeover |
| VTP | Malicious advertisements | VLAN database corruption |
| 802.1x | Authentication bypass | Network access without credentials |

## Pitfalls
1. **Network disruption**; L2 attacks can take down switches; test in lab first
2. **Root/sudo required**; needs raw socket access
3. **Legacy protocols**; many modern switches disable these by default
4. **ncurses GUI**; yersinia -I is interactive; Carina uses -D (daemon/discover mode)

## Verification
```bash
which yersinia
yersinia -h 2>&1 | head -20
```
