# Tool: evil-winrm | #23 | Windows Remote Management Shell


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
- **Binary:** `evil-winrm`
- **Package:** `evil-winrm`
- **Risk Level:** high
- **Requires Human Approval:** yes (remote shell)
- **OS Compatibility:** kali, parrot

## Purpose
Windows Remote Management (WinRM) shell using only PowerShell. Provides a post-exploitation shell on Windows hosts with WinRM enabled (port 5985/5986). Supports pass-the-hash, SSL, file upload/download, and in-memory execution of PowerShell scripts. Carina uses it for post-exploitation lateral movement.

## Carina CLI Command
```
carina exploit winrm <target> --username <user> [--password <pass>|--hash <ntlm>] [--command "<ps>"]
```

## TypeScript Wrapper

```typescript
export const evilWinrmTool: ToolDefinition = {
  name: 'evil_winrm_shell',
  description: 'WinRM shell; PowerShell remote access with pass-the-hash, SSL, file transfer.',
  parameters: {
    target:   { type: 'string', description: 'Target IP/hostname', required: true },
    username: { type: 'string', description: 'Windows username', required: true },
    password: { type: 'string', description: 'Password', required: false },
    hash:     { type: 'string', description: 'NTLM hash for pass-the-hash', required: false },
    command:  { type: 'string', description: 'PowerShell command to execute', required: false },
    ssl:      { type: 'boolean', default: false, description: 'Use SSL (port 5986)' },
    port:     { type: 'number', default: 5985 },
  },
  requires: ['evil-winrm'],
  risk: 'high',
  category: 'exploit',
  requiresApproval: true,
  handler: async (params, ctx) => {
    await ctx.requestApproval(`WinRM shell on ${params.target}`);
    const passArg = params.hash ? `-H ${params.hash}` : `-p '${params.password}'`;
    const cmdArg = params.command ? `-c '${params.command}'` : '-c "whoami; hostname; ipconfig"';
    const cmd = `evil-winrm -i ${params.target} -u ${params.username} ${passArg} -P ${params.port} ${params.ssl ? '-S' : ''} ${cmdArg}`;
    const result = await execSecure(cmd, { timeout: 60000 });
    return { target: params.target, username: params.username, output: result.stdout };
  },
};
```

## Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| target | string | yes |; | Target |
| username | string | yes |; | Windows username |
| password | string | one req |; | Password |
| hash | string | one req |; | NTLM hash |
| command | string | no | info gathering | PowerShell command |
| ssl | boolean | no | false | SSL (5986) |
| port | number | no | 5985 | Port |

## Workflow Chains
```
UPSTREAM:   19-impacket (credentials), 21-john/22-hashcat (cracked hashes)
DOWNSTREAM: 25-mimikatz (credential dumping via PowerShell)
```

## Pitfalls
1. **WinRM must be enabled**; default disabled on workstations; common on servers
2. **Admin required**; needs local admin or Remote Management Users group
3. **PowerShell logging**; Script Block Logging + AMSI may flag activity
4. **Ruby dependency**; requires ruby + winrm gem

## Verification
```bash
which evil-winrm
evil-winrm -h 2>&1 | head -5
```
