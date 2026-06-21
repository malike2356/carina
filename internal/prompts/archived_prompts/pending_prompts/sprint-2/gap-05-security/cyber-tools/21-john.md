# Tool: john | #21 | Password Cracker (CPU)


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
- **Binary:** `john`
- **Package:** `john`
- **Risk Level:** medium
- **Requires Human Approval:** no (offline cracking)
- **OS Compatibility:** kali, parrot

## Purpose
John the Ripper; CPU-based password hash cracker. Supports 400+ hash formats (NTLM, SHA, MD5, bcrypt, Kerberos, ZIP/RAR/PDF, SSH keys). Carina pipelines hash extraction (impacket secretsdump, zip2john, etc.) into automated cracking with wordlists + rules.

## Carina CLI Command
```
carina crack hash <file> [--format auto|ntlm|sha512crypt|bcrypt|krb5tgs|zip] [--wordlist <path>] [--rules <name>]
```

## TypeScript Wrapper

```typescript
export const johnTool: ToolDefinition = {
  name: 'john_crack',
  description: 'Password cracker; 400+ hash formats, wordlists, rules, incremental mode.',
  parameters: {
    hashFile:  { type: 'string', description: 'File containing hashes', required: true },
    format:    { type: 'string', description: 'Hash format (auto-detect if omitted)', required: false },
    wordlist:  { type: 'string', description: 'Wordlist path (default: rockyou)', required: false },
    rules:     { type: 'string', description: 'Rules (e.g., best64, kali, OneRuleToRuleThemAll)', default: 'best64' },
    mode:      { type: 'enum', values: ['wordlist', 'incremental', 'single'], default: 'wordlist' },
    session:   { type: 'string', description: 'Session name for resume', required: false },
    timeout:   { type: 'number', default: 3600, description: 'Max seconds' },
  },
  requires: ['john'],
  risk: 'medium',
  category: 'exploit',
  handler: async (params, ctx) => {
    const formatFlag = params.format ? `--format=${params.format}` : '';
    const wordlistPath = params.wordlist || '/usr/share/wordlists/rockyou.txt';
    const sessionFlag = params.session ? `--session=${params.session}` : `--session=carina_${Date.now()}`;
    const cmd = params.mode === 'wordlist'
      ? `john ${params.hashFile} ${formatFlag} --wordlist=${wordlistPath} --rules=${params.rules || 'best64'} ${sessionFlag}`
      : params.mode === 'incremental'
        ? `john ${params.hashFile} ${formatFlag} --incremental ${sessionFlag}`
        : `john ${params.hashFile} ${formatFlag} --single ${sessionFlag}`;
    const result = await execSecure(cmd, { timeout: (params.timeout || 3600) * 1000 });
    const cracked = await execSecure(`john --show ${params.hashFile}`);
    return parseJohnShow(cracked.stdout);
  },
};
```

## Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| hashFile | string | yes |; | Hash file |
| format | string | no | auto | Hash format |
| wordlist | string | no | rockyou | Wordlist |
| rules | string | no | best64 | Mutation rules |
| mode | enum | no | wordlist | Cracking mode |
| session | string | no | auto | Resume session |
| timeout | number | no | 3600 | Max seconds |

## Workflow Chains
```
UPSTREAM:   19-impacket (NTLM hashes), zip2john/rar2john (archive hashes)
DOWNSTREAM: 24-crackmapexec (use cracked creds)
CHAINS:     impacket secretsdump → john → hydra (validate against other services)
```

## Pitfalls
1. **Wordlist size**; rockyou is 14M entries; rule-based expansion = billions of attempts
2. **Format detection**; auto-detect can misidentify; specify --format for speed
3. **Session resume**; always use --session to enable pause/resume
4. **GPU advantage**; john is CPU-only; use hashcat for large jobs

## Verification
```bash
which john && john --version
echo 'admin:$1$salt$Xkd42JfOcE/FpHBtL2YFq1' > /tmp/test.hash
john /tmp/test.hash --wordlist=/usr/share/wordlists/rockyou.txt --rules=best64 --timeout=30 --session=test
```
