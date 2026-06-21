# Tool: crackmapexec | #24 | Swiss Army Knife for Networks


## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`

## Metadata
- **Priority:** MEDIUM
- **Source:** Kali Linux
- **Binary:** `crackmapexec` (aliased as `cme`)
- **Package:** `crackmapexec`
- **Risk Level:** high
- **Requires Human Approval:** yes
- **OS Compatibility:** kali, parrot

## Purpose
Post-exploitation swiss army knife. Enumerates and exploits SMB, WinRM, MSSQL, SSH, LDAP, RDP, and FTP services across entire subnets. Combines credential validation, hash dumping, command execution, and share enumeration. Carina uses cme for lateral movement and domain-wide credential spraying.

## Carina CLI Command
```
carina exploit cme <protocol> <target|CIDR> [--username <user> --password <pass>|--hash <ntlm>] [--module <name>]
```

## TypeScript Wrapper

```typescript
export const crackmapexecTool: ToolDefinition = {
  name: 'crackmapexec_exec',
  description: 'Multi-protocol swiss army knife; SMB, WinRM, MSSQL, SSH, LDAP, RDP, FTP.',
  parameters: {
    protocol: { type: 'enum', values: ['smb', 'winrm', 'mssql', 'ssh', 'ldap', 'rdp', 'ftp'], required: true },
    target:   { type: 'string', description: 'IP, hostname, or CIDR range', required: true },
    username: { type: 'string', description: 'Username', required: false },
    password: { type: 'string', description: 'Password', required: false },
    hash:     { type: 'string', description: 'NTLM hash', required: false },
    module:   { type: 'string', description: 'cme module (e.g., lsassy, nanodump, slinky)', required: false },
    command:  { type: 'string', description: 'Command to execute (-x)', required: false },
    threads:  { type: 'number', default: 100, description: 'Parallel threads' },
  },
  requires: ['crackmapexec'],
  risk: 'high',
  category: 'exploit',
  requiresApproval: true,
  handler: async (params, ctx) => {
    await ctx.requestApproval(`cme ${params.protocol} against ${params.target}`);
    const authFlag = params.hash ? `-H '${params.hash}'` : params.password ? `-p '${params.password}'` : '';
    const userFlag = params.username ? `-u ${params.username}` : '';
    const moduleFlag = params.module ? `-M ${params.module}` : '';
    const cmdFlag = params.command ? `-x '${params.command}'` : '';
    const cmd = `crackmapexec ${params.protocol} ${params.target} ${userFlag} ${authFlag} ${moduleFlag} ${cmdFlag} --threads ${params.threads || 100}`;
    const result = await execSecure(cmd, { timeout: 300000 });
    return parseCmeOutput(result.stdout);
  },
};
```

## Modules
| Module | Protocol | Purpose |
|--------|----------|---------|
| lsassy | SMB | Dump LSASS remotely (no disk write) |
| nanodump | SMB | Process memory dumper |
| slinky | SMB | Create symlink to steal NTLM hash |
| bloodhound | LDAP | BloodHound ingestion |
| web_delivery | SMB | PowerShell web delivery |
| mimikatz | SMB | Invoke-Mimikatz remotely |

## Workflow Chains
```
UPSTREAM:   22-hashcat (cracked hashes), 19-impacket (credentials)
DOWNSTREAM: 68-bloodhound (domain mapping)
CHAINS:     hashcat → crackmapexec smb (validate creds across entire domain)
```

## Pitfalls
1. **Detection**; cme is signatured by EDR; use with caution on monitored networks
2. **CIDR scanning**; spraying a /16 subnet triggers every SIEM
3. **Threads**; 100 threads against WAN = dropped connections; reduce for remote targets

## Verification
```bash
which crackmapexec && crackmapexec --version
```
