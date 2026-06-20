# Tool: wifite | #36 | Automated WiFi Attack

## Metadata
- **Priority:** MEDIUM; **Source:** Kali; **Binary:** `wifite`; **Package:** `wifite`
- **Risk:** high; **Approval:** yes; **OS:** kali

## Purpose
Automated WiFi attack tool. Scans for networks, sorts by signal strength, and automatically attempts WPS PIN attacks and WPA handshake capture + cracking. "Fire and forget" wireless auditing. Carina uses it as a quick WiFi pentest option.

## Carina CLI Command
```
carina wireless auto <interface> [--wps] [--wpa] [--crack] [--kill]
```

## TypeScript Wrapper

```typescript
export const wifiteTool: ToolDefinition = {
  name: 'wifite_auto',
  description: 'Automated WiFi attacker; WPS PIN, WPA handshake capture + cracking.',
  parameters: {
    interface: { type: 'string', required: true },
    wps: { type: 'boolean', default: true },
    wpa: { type: 'boolean', default: true },
    crack: { type: 'boolean', default: true },
    kill: { type: 'boolean', default: false, description: 'Kill conflicting processes' },
    timeout: { type: 'number', default: 600 },
  },
  requires: ['wifite'],
  risk: 'high',
  category: 'wireless',
  requiresApproval: true,
  handler: async (params, ctx) => {
    await ctx.requestApproval('Automated WiFi attack; ensure you own this network');
    const flags = [
      params.wps ? '--wps' : '--no-wps',
      params.wpa ? '--wpa' : '--no-wpa',
      params.crack ? '--crack' : '--no-crack',
      params.kill ? '-kill' : '',
    ].filter(Boolean).join(' ');
    const cmd = `wifite -i ${params.interface} ${flags} -p 30 --dict /usr/share/wordlists/rockyou.txt`;
    const result = await execSecure(cmd, { timeout: (params.timeout || 600) * 1000 });
    return parseWifiteOutput(result.stdout);
  },
};
```

## Parameters
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| interface | string |; | WiFi interface |
| wps | boolean | true | Try WPS PIN attacks |
| wpa | boolean | true | Capture WPA handshakes |
| crack | boolean | true | Crack captured handshakes |
| kill | boolean | false | Kill conflicting processes |
| timeout | number | 600 | Max seconds |

## Pitfalls
1. **Fully automated**; attacks everything in range; ensure scoping
2. **WPS attacks destructive**; some routers reboot after PIN attempts
3. **Rockyou default**; change dict for better results

## Verification
```bash
which wifite
wifite --help | head -10
```
