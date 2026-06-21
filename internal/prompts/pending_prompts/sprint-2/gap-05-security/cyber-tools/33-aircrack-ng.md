# Tool: aircrack-ng | #33 | WiFi Security Auditing


## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`

## Metadata
- **Priority:** HIGH; **Source:** Kali; **Binary:** `aircrack-ng`; **Package:** `aircrack-ng`
- **Risk:** high; **Approval:** yes (wireless attacks); **OS:** kali, parrot (needs monitor-mode WiFi)

## Purpose
Complete WiFi security auditing suite. Captures packets, cracks WEP/WPA/WPA2 keys, deauthenticates clients, and creates fake access points. Carina uses aircrack-ng for wireless penetration testing and rogue AP detection.

## Carina CLI Command
```
carina wireless audit <interface> [--target <BSSID>] [--mode wep|wpa|wpa2|capture] [--wordlist <file>]
```

## TypeScript Wrapper

```typescript
export const aircrackTool: ToolDefinition = {
  name: 'aircrack_audit',
  description: 'WiFi auditing; WEP/WPA/WPA2 cracking, packet capture, deauth, rogue AP.',
  parameters: {
    interface: { type: 'string', description: 'Monitor-mode interface (e.g., wlan0mon)', required: true },
    target: { type: 'string', description: 'Target BSSID' },
    mode: { type: 'enum', values: ['wep', 'wpa', 'wpa2', 'capture', 'deauth'], default: 'capture' },
    wordlist: { type: 'string', description: 'WPA wordlist' },
    channel: { type: 'number' },
    timeout: { type: 'number', default: 300 },
  },
  requires: ['aircrack-ng'],
  risk: 'high',
  category: 'wireless',
  requiresApproval: true,
  handler: async (params, ctx) => {
    await ctx.requestApproval(`WiFi audit on ${params.interface}; ensure you own this network`);
    // Step 1: Start monitor mode
    await execSecure(`airmon-ng start ${params.interface}`);
    const monIface = `${params.interface}mon`;
    // Step 2: Capture (airodump-ng)
    const captureFile = `/tmp/capture_${Date.now()}`;
    let cmd = `airodump-ng ${monIface} -w ${captureFile} --output-format pcap`;
    if (params.channel) cmd += ` -c ${params.channel}`;
    if (params.target) cmd += ` --bssid ${params.target}`;
    await execSecure(cmd, { timeout: (params.timeout || 300) * 1000, background: true });
    // Step 3: Crack (if WPA)
    if (params.mode.startsWith('wpa')) {
      const wl = params.wordlist || '/usr/share/wordlists/rockyou.txt';
      const crack = await execSecure(`aircrack-ng ${captureFile}-01.cap -w ${wl}`, { timeout: 600000 });
      return { capture: captureFile, cracked: crack.stdout };
    }
    await execSecure(`airmon-ng stop ${monIface}`);
    return { capture: captureFile };
  },
};
```

## Parameters
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| interface | string |; | WiFi interface |
| target | string |; | Target BSSID |
| mode | enum | capture | Attack mode |
| wordlist | string | rockyou | WPA wordlist |
| channel | number |; | Specific channel |
| timeout | number | 300 | Capture duration |

## Workflow Chains
```
UPSTREAM:   35-kismet (AP discovery)
DOWNSTREAM: 34-bettercap (MITM after cracking)
```

## Pitfalls
1. **Monitor mode**; not all WiFi chipsets support monitor mode
2. **Illegal without permission**; cracking WiFi you don't own is a crime
3. **WPA3**; aircrack-ng cannot crack WPA3; use Dragonblood techniques
4. **Handshake capture**; needs client deauth to capture WPA handshake
5. **Root required**; monitor mode + raw sockets need root

## Verification
```bash
which aircrack-ng && aircrack-ng --help | head -5
airmon-ng  # list wireless interfaces
```
