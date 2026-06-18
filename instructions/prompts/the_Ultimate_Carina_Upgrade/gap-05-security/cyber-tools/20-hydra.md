# Tool: hydra | #20 | Network Login Brute-Forcer

## Metadata
- **Priority:** HIGH
- **Source:** Kali Linux
- **Binary:** `hydra`
- **Package:** `hydra`
- **Risk Level:** high
- **Requires Human Approval:** yes (account lockout risk)
- **OS Compatibility:** kali, parrot

## Purpose
Parallelized network login brute-forcer supporting 50+ protocols: SSH, FTP, HTTP-POST, RDP, SMB, MySQL, PostgreSQL, MongoDB, SMTP, IMAP, LDAP, and more. Carina uses Hydra for credential validation, password spraying, and default credential testing against discovered services.

## Carina CLI Command
```
carina brute service <target> --protocol <proto> [--users <file>] [--passwords <file>] [--mode spray|brute]
```

## TypeScript Wrapper

```typescript
export const hydraTool: ToolDefinition = {
  name: 'hydra_brute',
  description: 'Network brute-force: SSH, FTP, HTTP, RDP, SMB, databases; 50+ protocols.',
  parameters: {
    target:    { type: 'string', description: 'Target IP or hostname', required: true },
    port:      { type: 'number', description: 'Target port', required: true },
    protocol:  { type: 'enum', values: ['ssh','ftp','http-post','rdp','smb','mysql','postgres','mssql','mongodb','ldap','imap','smtp','vnc','snmp'], required: true },
    username:  { type: 'string', description: 'Single username', required: false },
    password:  { type: 'string', description: 'Single password', required: false },
    userFile:  { type: 'string', description: 'Username wordlist path', required: false },
    passFile:  { type: 'string', description: 'Password wordlist path', required: false },
    mode:      { type: 'enum', values: ['brute', 'spray'], default: 'brute', description: 'brute=each u:p combo, spray=1pass many users' },
    tasks:     { type: 'number', default: 16, description: 'Parallel tasks (1-64)' },
    timeout:   { type: 'number', default: 300, description: 'Max seconds' },
  },
  requires: ['hydra'],
  risk: 'high',
  category: 'exploit',
  requiresApproval: true,
  handler: async (params, ctx) => {
    await ctx.requestApproval(`Brute force ${params.protocol} against ${params.target}:${params.port}`);
    const userArg = params.username ? `-l ${params.username}` : `-L ${params.userFile}`;
    const passArg = params.password ? `-p ${params.password}` : `-P ${params.passFile}`;
    const sprayFlag = params.mode === 'spray' ? '-u' : ''; // -u = loop users first (spray)
    const cmd = `hydra ${userArg} ${passArg} ${sprayFlag} -t ${params.tasks} -o /dev/stdout ${params.protocol}://${params.target}:${params.port}`;
    const result = await execSecure(cmd, { timeout: (params.timeout || 300) * 1000 });
    return parseHydraOutput(result.stdout);
  },
};
```

## Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| target | string | yes |; | Target |
| port | number | yes |; | Port |
| protocol | enum | yes |; | Service protocol |
| username/password | string | one required |; | Single credential |
| userFile/passFile | string | one required |; | Wordlist path |
| mode | enum | no | brute | brute=all combos, spray=1p:many u |
| tasks | number | no | 16 | Parallel threads |
| timeout | number | no | 300 | Max seconds |

## Workflow Chains
```
UPSTREAM:   10-cewl (custom wordlist), 01-nmap (open ports)
DOWNSTREAM: 19-impacket (use cracked creds for lateral movement)
CHAINS:     nmap → hydra → impacket psexec (use found creds for remote execution)
```

## Structured Output
```json
{
  "target": "10.0.0.5",
  "protocol": "ssh",
  "port": 22,
  "attempts": 7342,
  "found": [
    { "username": "root", "password": "toor" },
    { "username": "admin", "password": "admin123" }
  ]
}
```

## Pitfalls
1. **Account lockout**; too many failed attempts triggers lockout; use spray mode (-u)
2. **IDS/WAF detection**; brute force is noisy; stagger timing (-W for wait between attempts)
3. **Service limits**; SSH has MaxAuthTries (default 6); connection-level brute is slow
4. **HTTP-POST complexity**; needs exact POST body + failure string; use Burp to capture
5. **Speed vs accuracy**; high task count causes timeouts; stay ≤16 for WAN targets

## Verification
```bash
which hydra && hydra -h 2>&1 | head -5
hydra -l test -p test ssh://localhost:22 -t 1 -w 2
```
