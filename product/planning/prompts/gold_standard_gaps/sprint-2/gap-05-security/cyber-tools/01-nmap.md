# Tool: nmap | #01 | Reconnaissance

## Metadata
- **Priority:** CRITICAL
- **Source:** Kali Linux
- **Binary:** `nmap`
- **Package:** `nmap`
- **Risk Level:** medium
- **Requires Human Approval:** no
- **OS Compatibility:** kali, parrot, any

## Purpose
Network discovery and security auditing. Nmap detects live hosts, open ports, running services, OS fingerprints, and service versions. Carina uses nmap as the first step in any reconnaissance workflow to build an attack surface map.

## Carina CLI Command
```
carina recon scan <target> [--scan-type quick|full|stealth|service|os|vuln] [--options "..."]
```

## TypeScript Wrapper

```typescript
// tools/security/recon/nmap.ts

export const SCAN_TYPE_FLAGS: Record<string, string> = {
  quick:    '-T4 -F',
  full:     '-T4 -p-',
  stealth:  '-sS -T2 -f --data-length 24',
  service:  '-sV --version-intensity 5',
  os:       '-O --osscan-guess',
  vuln:     '--script vuln',
};

export const nmapTool: ToolDefinition = {
  name: 'nmap_scan',
  description: 'Network discovery; ports, services, OS, vulnerabilities.',
  parameters: {
    target:     { type: 'string', description: 'IP, hostname, or CIDR range', required: true },
    scanType:   { type: 'enum', values: ['quick','full','stealth','service','os','vuln'], default: 'quick' },
    options:    { type: 'string', description: 'Additional raw nmap flags', required: false },
    timeout:    { type: 'number', default: 300, description: 'Max scan seconds' },
  },
  requires: ['nmap'],
  risk: 'medium',
  category: 'recon',
  handler: async (params, ctx) => {
    const flags = SCAN_TYPE_FLAGS[params.scanType] || SCAN_TYPE_FLAGS.quick;
    const cmd = `nmap ${flags} ${params.options || ''} -oX - ${params.target}`;
    const result = await execSecure(cmd, { timeout: (params.timeout || 300) * 1000 });
    if (result.exitCode !== 0) throw new Error(`nmap failed: ${result.stderr}`);
    return parseNmapXml(result.stdout);
  },
};
```

## Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| target | string | yes |; | IP, hostname, or CIDR (e.g. 192.168.1.0/24) |
| scanType | enum | no | quick | quick/full/stealth/service/os/vuln |
| options | string | no |; | Raw nmap flags for advanced use |
| timeout | number | no | 300 | Max scan duration in seconds |

## Workflow Chains
```
UPSTREAM:   (none; recon entry point)
DOWNSTREAM: 02-amass, 03-theHarvester, 11-nuclei, 12-nikto
CHAINS:     nmap → nuclei (feed ports to vuln scanner)
            nmap → nikto (feed web ports 80/443 to web scanner)
            nmap → metasploit (service+version → exploit selection)
```

## Usage Examples
```bash
carina recon scan 192.168.1.1 --scan-type quick
carina recon scan 10.0.0.0/24 --scan-type full --timeout 600
carina recon scan target.com --scan-type stealth --options "-T1 --randomize-hosts"
```

## Structured Output
```json
{
  "target": "192.168.1.0/24", "scanType": "quick", "duration": 45.2,
  "hosts": { "total": 256, "up": 12, "down": 244 },
  "ports": [
    { "port": 22, "protocol": "tcp", "state": "open", "service": "ssh", "version": "OpenSSH 8.9p1" },
    { "port": 443, "protocol": "tcp", "state": "open", "service": "https", "version": "nginx 1.24.0" }
  ],
  "osMatches": [{ "name": "Linux 5.15", "accuracy": 92 }]
}
```

## Pitfalls
1. **SYN scans need root**; fall back to TCP connect (-sT) without sudo
2. **Firewall interference**; stealth scan may return empty; try full TCP connect
3. **IDS/IPS alerts**; aggressive scans (-T4/-T5) trigger alerts; use -T2 for stealth
4. **CIDR scans are slow**; /16 = 65K IPs; use quick scan and narrow range
5. **DNS latency**; use -n to skip reverse DNS for faster scans
6. **NSE script hangs**; set --script-timeout for vuln scans
7. **Scope validation**; always verify target is in engagement scope before scanning

## Verification
```bash
which nmap && nmap --version
nmap -T4 -F localhost
ls /usr/share/nmap/scripts/ | wc -l  # count NSE scripts
```
