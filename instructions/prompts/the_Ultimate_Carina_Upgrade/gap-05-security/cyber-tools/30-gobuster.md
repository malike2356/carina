# Tool: gobuster | #30 | Directory/DNS/VHOST Buster

## Metadata
- **Priority:** HIGH; **Source:** Kali; **Binary:** `gobuster`; **Package:** `gobuster`
- **Risk:** medium; **Approval:** no; **OS:** kali, parrot, any (Go binary)

## Purpose
Multi-mode brute force tool: directory/file enumeration (dir mode), DNS subdomain enumeration (dns mode), virtual host discovery (vhost mode), and S3 bucket enumeration (s3 mode). Written in Go; single binary, no dependencies, fast. Carina uses it as a lightweight fuzzer when ffuf is not available.

## Carina CLI Command
```
carina fuzz gobuster <mode> <target> [--wordlist <file>] [--threads N]
```

## TypeScript Wrapper

```typescript
export const gobusterTool: ToolDefinition = {
  name: 'gobuster_scan',
  description: 'Multi-mode brute-forcer; dir, dns, vhost, s3.',
  parameters: {
    mode: { type: 'enum', values: ['dir', 'dns', 'vhost', 's3'], required: true },
    target: { type: 'string', required: true },
    wordlist: { type: 'string' },
    threads: { type: 'number', default: 10 },
    extensions: { type: 'array', items: 'string' },
    statusCodes: { type: 'string', default: '200,204,301,302,307,401,403,405' },
  },
  requires: ['gobuster'],
  risk: 'medium',
  category: 'web',
  handler: async (params, ctx) => {
    const wl = params.wordlist || (params.mode === 'dns' ? '/usr/share/seclists/Discovery/DNS/subdomains-top1million-5000.txt' : '/usr/share/wordlists/dirbuster/directory-list-2.3-medium.txt');
    const extFlag = params.mode === 'dir' && params.extensions ? `-x ${params.extensions.join(',')}` : '';
    const cmd = `gobuster ${params.mode} -u ${params.target} -w ${wl} -t ${params.threads || 10} -s '${params.statusCodes}' ${extFlag} -o /dev/stdout`;
    const result = await execSecure(cmd, { timeout: 300000 });
    return parseGobusterOutput(result.stdout);
  },
};
```

## Modes
| Mode | Target Format | Use Case |
|------|--------------|----------|
| dir | `https://example.com` | Directory/file discovery |
| dns | `example.com` | Subdomain enumeration |
| vhost | `http://example.com` | Virtual host discovery |
| s3 | `example` | S3 bucket enumeration |

## Pitfalls
1. **DNS mode slow**; DNS resolution per word makes it much slower than amass
2. **Status code noise**; CDNs return 200 for 404; use --wildcard detection
3. **Threads**; gobuster threads are less efficient than ffuf; use 10-20 max

## Verification
```bash
which gobuster && gobuster version
gobuster dir -u https://example.com -w /usr/share/wordlists/dirb/common.txt -t 5
```
