# Tool: kismet | #35 | Wireless Network Detector


## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`

## Metadata
- **Priority:** MEDIUM; **Source:** Kali; **Binary:** `kismet`; **Package:** `kismet`
- **Risk:** low; **Approval:** no; **OS:** kali, parrot

## Purpose
Passive wireless network detector and sniffer. Detects WiFi, Bluetooth, and Software-Defined Radio (SDR) devices without transmitting. Logs SSIDs, BSSIDs, signal strength, clients, and probe requests. Carina uses kismet for passive wireless reconnaissance.

## Carina CLI Command
```
carina wireless discover <interface> [--duration N] [--output json|kismet]
```

## TypeScript Wrapper

```typescript
export const kismetTool: ToolDefinition = {
  name: 'kismet_scan',
  description: 'Passive WiFi/Bluetooth/SDR detection; no transmission, undetectable.',
  parameters: {
    interface: { type: 'string', required: true },
    source: { type: 'string', description: 'Source type + interface (e.g., wlan0=wlan0)' },
    duration: { type: 'number', default: 60 },
  },
  requires: ['kismet'],
  risk: 'low',
  category: 'wireless',
  handler: async (params, ctx) => {
    const src = params.source || `${params.interface}=${params.interface}`;
    const cmd = `kismet -c ${src} --no-gps --daemonize 2>/dev/null; sleep 5;` +
      `curl -s http://127.0.0.1:2501/devices/views/all/devices.json | jq '.'`;
    const result = await execSecure(cmd, { timeout: (params.duration || 60) * 1000 });
    await execSecure('kismet --stop');
    return JSON.parse(result.stdout);
  },
};
```

## Output
```json
[{
  "kismet.device.base.macaddr": "AA:BB:CC:DD:EE:FF",
  "kismet.device.base.name": "OfficeWiFi",
  "kismet.device.base.signal": -45,
  "kismet.device.base.channel": "6",
  "kismet.device.base.type": "Wi-Fi AP"
}]
```

## Pitfalls
1. **Web UI dependency**; Kismet runs as a web server on port 2501
2. **Monitor mode**; needs interface in monitor mode first
3. **GPS**; --no-gps flag needed for headless operation

## Verification
```bash
which kismet && kismet --version
```
