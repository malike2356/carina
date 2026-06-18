# Tool: binwalk | #42 | Firmware Analysis

## Metadata
- **Priority:** HIGH; **Source:** Kali; **Binary:** `binwalk`; **Package:** `binwalk`
- **Risk:** low; **Approval:** no; **OS:** kali, parrot, any

## Purpose
Firmware analysis and extraction tool. Scans binary images for embedded file systems, compressed data, and executable code. Extracts squashfs, cramfs, jffs2, cpio archives, and other embedded filesystems from firmware, disk images, and raw binaries; critical for IoT/embedded device security.

## Carina CLI Command
```
carina forensic firmware <image> [--extract] [--entropy] [--deep]
```

## TypeScript Wrapper

```typescript
export const binwalkTool: ToolDefinition = {
  name: 'binwalk_analyze',
  description: 'Firmware analysis; extract embedded filesystems, compressed data, executables.',
  parameters: {
    image: { type: 'string', required: true },
    extract: { type: 'boolean', default: true },
    entropy: { type: 'boolean', default: false, description: 'Generate entropy graph' },
    deep: { type: 'boolean', default: false, description: 'Deep extraction (recursive)' },
    outputDir: { type: 'string', description: 'Extraction directory' },
    signature: { type: 'boolean', default: true, description: 'Run signature scan' },
  },
  requires: ['binwalk'],
  risk: 'low',
  category: 'forensic',
  handler: async (params, ctx) => {
    const outDir = params.outputDir || `/tmp/binwalk_${Date.now()}`;
    const flags = [
      params.extract ? '-e' : '',
      params.entropy ? '-E' : '',
      params.deep ? '-M' : '',
      params.signature ? '-B' : '',
    ].filter(Boolean).join(' ');
    const cmd = `binwalk ${flags} --directory=${outDir} ${params.image}`;
    const result = await execSecure(cmd, { timeout: 600000 });
    return { image: params.image, outputDir: outDir, findings: result.stdout };
  },
};
```

## Output
```
DECIMAL    HEX        DESCRIPTION
0          0x0        uImage header, header size: 64 bytes
64         0x40       LZMA compressed data
1048576    0x100000   Squashfs filesystem, little endian, version 4.0
5242880    0x500000   JFFS2 filesystem, little endian
15728640   0xF00000   Certificate in DER format
```

## Pitfalls
1. **False positives**; many file signatures overlap; manual verification needed
2. **Obfuscated firmware**; encrypted/obfuscated firmware needs decryption first
3. **Deep extraction**; `-M` recursively extracts nested archives; can be huge

## Verification
```bash
which binwalk && binwalk --version
binwalk -B /bin/ls | head -10
```
