# Tool: bulk-extractor | #44 | Bulk Data Extraction

## Metadata
- **Priority:** HIGH; **Source:** Kali/CSI; **Binary:** `bulk_extractor`; **Package:** `bulk-extractor`
- **Risk:** low; **Approval:** no; **OS:** kali, csi

## Purpose
High-speed bulk data extractor. Scans disk images, files, and directories for emails, URLs, credit card numbers, phone numbers, domain names, IP addresses, and EXIF data. Processes terabytes in hours. Carina uses it for rapid evidence triage.

## Carina CLI Command
```
carina forensic extract <image> [--features all|email,url,ccn,domain] [--output <dir>]
```

## TypeScript Wrapper

```typescript
export const bulkExtractorTool: ToolDefinition = {
  name: 'bulk_extractor_scan',
  description: 'Bulk data extraction; emails, URLs, credit cards, domains from disk images.',
  parameters: {
    image: { type: 'string', required: true },
    features: { type: 'array', items: 'string', default: ['all'] },
    outputDir: { type: 'string', required: true },
    threads: { type: 'number', default: 0, description: '0 = auto (all cores)' },
  },
  requires: ['bulk_extractor'],
  risk: 'low',
  category: 'forensic',
  handler: async (params, ctx) => {
    const featFlag = params.features.includes('all') ? '-e all' : `-e ${params.features.join(',')}`;
    const cmd = `bulk_extractor -o ${params.outputDir} ${featFlag} -j ${params.threads || 0} ${params.image}`;
    const result = await execSecure(cmd, { timeout: 86400000 });
    const files = await execSecure(`ls ${params.outputDir}`);
    return { outputDir: params.outputDir, extractedFiles: files.stdout.trim().split('\n') };
  },
};
```

## Features
| Feature | Output File | Example |
|---------|------------|---------|
| email | email.txt | user@example.com |
| url | url.txt | https://example.com/page |
| domain | domain.txt | example.com |
| ccn | ccn.txt | 4111-1111-1111-1111 |
| telephone | telephone.txt | +1-555-1234 |
| exif | exif.txt | GPS coordinates |
| json | json.txt | JSON objects |
| rfc822 | rfc822.txt | Email headers |

## Pitfalls
1. **Disk space**; extracted files can exceed original image size
2. **False positives**; CCN detection triggers on 16-digit hex strings
3. **Encrypted data**; cannot extract from encrypted/buried data

## Verification
```bash
which bulk_extractor && bulk_extractor -V
bulk_extractor -o /tmp/be_test -e email /bin/ls
```
