# Tool: impacket | #19 | Windows Network Protocol Tools


## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`

## Metadata
- **Priority:** HIGH
- **Source:** Kali Linux
- **Binary:** `impacket-secretsdump`, `impacket-smbclient`, `impacket-psexec`, `impacket-wmiexec`, `impacket-GetNPUsers`, `impacket-GetUserSPNs`, 20+ more
- **Package:** `impacket-scripts`
- **Risk Level:** high
- **Requires Human Approval:** yes (credential extraction, remote execution)
- **OS Compatibility:** kali, parrot

## Purpose
Collection of Python tools for Windows network protocol exploitation. Handles SMB, DCERPC, WMI, Kerberos, LDAP, and MSSQL. Key capabilities: credential dumping (secretsdump), pass-the-hash (psexec/wmiexec), Kerberos attacks (GetNPUsers/GetUserSPNs), and SMB enumeration. Carina chains impacket tools for Windows domain exploitation pipelines.

## Carina CLI Command
```
carina exploit impacket <tool> <target> [--username <user> --password <pass>|--hash <ntlm>] [--domain <domain>]
```

## TypeScript Wrapper

```typescript
const IMPACKET_TOOLS = {
  'secretsdump': { binary: 'impacket-secretsdump', desc: 'Dump SAM/SECRETS/NTDS credentials', risk: 'critical' },
  'psexec':      { binary: 'impacket-psexec', desc: 'Remote command execution via SMB', risk: 'critical' },
  'wmiexec':     { binary: 'impacket-wmiexec', desc: 'Remote execution via WMI', risk: 'critical' },
  'smbclient':   { binary: 'impacket-smbclient', desc: 'SMB client (list/copy files)', risk: 'high' },
  'GetNPUsers':  { binary: 'impacket-GetNPUsers', desc: 'AS-REP roasting (kerberoastable users)', risk: 'high' },
  'GetUserSPNs': { binary: 'impacket-GetUserSPNs', desc: 'Kerberoasting (service accounts)', risk: 'high' },
  'lookupsid':   { binary: 'impacket-lookupsid', desc: 'SID enumeration → user list', risk: 'medium' },
  'samrdump':    { binary: 'impacket-samrdump', desc: 'SAM enumeration via SAMR', risk: 'medium' },
};

export const impacketTool: ToolDefinition = {
  name: 'impacket_exec',
  description: 'Windows network protocol exploitation; SMB, WMI, Kerberos, LDAP, MSSQL.',
  parameters: {
    tool:     { type: 'enum', values: Object.keys(IMPACKET_TOOLS), required: true },
    target:   { type: 'string', description: 'Target IP or hostname', required: true },
    username: { type: 'string', description: 'Windows username (DOMAIN\\user)', required: false },
    password: { type: 'string', description: 'Password', required: false },
    hash:     { type: 'string', description: 'NTLM hash for pass-the-hash', required: false },
    domain:   { type: 'string', description: 'Active Directory domain', required: false },
    command:  { type: 'string', description: 'Command to execute (psexec/wmiexec)', required: false },
    ticket:   { type: 'string', description: 'Kerberos ticket file (ccache)', required: false },
  },
  requires: [`impacket-${'tool detected dynamically'}`],
  risk: 'high',
  category: 'exploit',
  requiresApproval: true,
  handler: async (params, ctx) => {
    const toolInfo = IMPACKET_TOOLS[params.tool];
    await ctx.requestApproval(`impacket ${params.tool} against ${params.target}`);
    let cmd = `${toolInfo.binary}`;
    if (params.username) cmd += ` ${params.username}`;
    if (params.password) cmd += `:${params.password}`;
    if (params.hash) cmd += ` -hashes :${params.hash}`;
    cmd += `@${params.target}`;
    if (params.domain) cmd += ` -dc-ip ${params.target}`;
    if (params.command) cmd += ` "${params.command}"`;
    const result = await execSecure(cmd, { timeout: 120000 });
    return { tool: params.tool, target: params.target, output: result.stdout };
  },
};
```

## Key Sub-Tools
| Tool | Purpose | Auth Needed |
|------|---------|------------|
| secretsdump | Dump SAM/LSA/NTDS hashes | Admin |
| psexec | Remote shell via SMB (writes service) | Admin |
| wmiexec | Remote shell via WMI (fileless) | Admin |
| smbclient | Browse/copy SMB shares | Any/SMB |
| GetNPUsers | AS-REP roasting (no pre-auth users) | None (enum) |
| GetUserSPNs | Kerberoasting service accounts | Any domain user |
| lookupsid | Enumerate domain users via SID | Any |

## Workflow Chains
```
UPSTREAM:   18-metasploit (session on Windows host)
DOWNSTREAM: 25-mimikatz (LSASS dump), 24-crackmapexec (spread)
CHAINS:     lookupsid → GetNPUsers → john (crack TGT) → psexec (admin access)
            secretsdump → hashcat (crack NTLM) → wmiexec (lateral movement)
```

## Structured Output (secretsdump)
```json
{
  "tool": "secretsdump",
  "target": "10.0.0.10",
  "hashes": {
    "Administrator:500": "aad3b435b51404eeaad3b435b51404ee:fc525c9683e8fe067095e2a70e8a0a7e",
    "jsmith:1105": "aad3b435b51404eeaad3b435b51404ee:8846f7eaee8fb117ad06bdd830b7586c"
  }
}
```

## Pitfalls
1. **Admin required**; secretsdump/psexec/wmiexec need admin credentials
2. **AV detection**; psexec writes a service binary; many AVs flag this
3. **Kerberos clock sync**; domain must be ≤5min drift or Kerberos auth fails
4. **DNS resolution**; Windows tools need DNS resolving; set /etc/hosts
5. **SMB signing**; some domains enforce SMB signing; relay attacks blocked
6. **Password in logs**; command-line passwords visible in process list

## Verification
```bash
dpkg -l | grep impacket
impacket-secretsdump -h 2>&1 | head -5
```
