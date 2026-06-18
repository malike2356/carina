# Tool: hashcat | #22 | GPU-Accelerated Password Cracker

## Metadata
- **Priority:** HIGH
- **Source:** Kali Linux
- **Binary:** `hashcat`
- **Package:** `hashcat`
- **Risk Level:** medium
- **Requires Human Approval:** no (offline)
- **OS Compatibility:** kali, parrot (needs GPU)

## Purpose
World's fastest password cracker. GPU-accelerated (CUDA/OpenCL) with 300+ hash modes, supporting rule-based attacks, mask attacks, combinator attacks, and hybrid modes. 10-100x faster than CPU cracking. Carina uses hashcat for large hash dumps and when GPU is available.

## Carina CLI Command
```
carina crack gpu <hashfile> [--mode N] [--attack wordlist|mask|combinator|hybrid] [--mask "?a?a?a?a?a?a?a?a"]
```

## TypeScript Wrapper

```typescript
const HASH_MODES: Record<string, number> = {
  md5: 0, ntlm: 1000, sha256: 1400, sha512: 1700,
  bcrypt: 3200, kerberos_tgs: 13100, kerberos_asrep: 18200,
  wpa2: 22000, zip: 13600, pdf: 10500, ethereum: 15700,
};

export const hashcatTool: ToolDefinition = {
  name: 'hashcat_crack',
  description: 'GPU-accelerated password cracker; 300+ hash modes, 10-100x faster than CPU.',
  parameters: {
    hashFile:  { type: 'string', description: 'Hash file', required: true },
    hashMode:  { type: 'number', description: 'Hash mode ID (0=MD5, 1000=NTLM, 13100=Kerberos)', required: true },
    attackMode:{ type: 'enum', values: ['wordlist', 'mask', 'combinator', 'hybrid'], default: 'wordlist' },
    wordlist:  { type: 'string', description: 'Wordlist path', required: false },
    rules:     { type: 'string', description: 'Rule file (e.g., /usr/share/hashcat/rules/best64.rule)', required: false },
    mask:      { type: 'string', description: 'Mask (e.g., ?a?a?a?a?a?a?a?a = 8-char all)', required: false },
    device:    { type: 'number', description: 'GPU device ID', required: false },
    session:   { type: 'string', description: 'Session for restore', required: false },
    timeout:   { type: 'number', default: 3600, description: 'Max seconds' },
  },
  requires: ['hashcat'],
  risk: 'medium',
  category: 'exploit',
  handler: async (params, ctx) => {
    const sessionFlag = params.session ? `--session=${params.session}` : `--session=carina_${Date.now()}`;
    const deviceFlag = params.device !== undefined ? `-d ${params.device}` : '';
    let cmd = `hashcat -m ${params.hashMode} ${params.hashFile}`;
    if (params.attackMode === 'wordlist') cmd += ` ${params.wordlist || '/usr/share/wordlists/rockyou.txt'} -r ${params.rules || '/usr/share/hashcat/rules/best64.rule'}`;
    else if (params.attackMode === 'mask') cmd += ` -a 3 ${params.mask || '?a?a?a?a?a?a?a?a'}`;
    cmd += ` ${deviceFlag} ${sessionFlag} --status --status-timer=30 -O`;
    const result = await execSecure(cmd, { timeout: (params.timeout || 3600) * 1000 });
    const show = await execSecure(`hashcat -m ${params.hashMode} ${params.hashFile} --show`);
    return parseHashcatShow(show.stdout);
  },
};
```

## Mask Charsets
| Charset | Characters | Count |
|---------|-----------|-------|
| ?l | abcdefghijklmnopqrstuvwxyz | 26 |
| ?u | ABCDEFGHIJKLMNOPQRSTUVWXYZ | 26 |
| ?d | 0123456789 | 10 |
| ?s | !"#$%&'()*+,-./:;<=>?@[\]^_`{ | }~ | 33 |
| ?a | ?l?u?d?s | 95 |
| ?b | 0x00-0xff | 256 |

## Workflow Chains
```
UPSTREAM:   19-impacket (NTDS.dit dump), rar2john/zip2john (archives)
DOWNSTREAM: 24-crackmapexec (password spraying cracked creds)
```

## Pitfalls
1. **GPU required**; no GPU = no hashcat; fall back to john
2. **Driver issues**; CUDA/OpenCL drivers fragile; test with `hashcat -I`
3. **Power/heat**; hashcat at 100% GPU can overheat; monitor temps
4. **Mask complexity**; ?a?a?a?a?a?a?a?a (8 char) = 95^8 = 6.6 quadrillion; use smarter masks
5. **Restore**; always use --session for crash recovery

## Verification
```bash
which hashcat && hashcat --version
hashcat -I  # list devices
echo '5f4dcc3b5aa765d61d8327deb882cf99' > /tmp/test.txt
hashcat -m 0 /tmp/test.txt /usr/share/wordlists/rockyou.txt -O --timeout=10
```
