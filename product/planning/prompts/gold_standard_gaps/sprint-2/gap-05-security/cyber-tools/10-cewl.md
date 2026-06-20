# Tool: cewl | #10 | Custom Wordlist Generator

## Metadata
- **Priority:** MEDIUM
- **Source:** Kali Linux
- **Binary:** `cewl`
- **Package:** `cewl`
- **Risk Level:** low
- **Requires Human Approval:** no
- **OS Compatibility:** kali, parrot

## Purpose
Custom wordlist generator that spiders a target website and extracts unique words to create targeted password lists and username guesses. Essential for credential attacks; generates company-specific wordlists that vastly outperform generic dictionaries.

## Carina CLI Command
```
carina recon wordlist <url> [--depth N] [--min-length N] [--output <file>]
```

## TypeScript Wrapper

```typescript
export const cewlTool: ToolDefinition = {
  name: 'cewl_generate',
  description: 'Spider website → extract words → generate targeted password/username wordlist.',
  parameters: {
    url:       { type: 'string', description: 'Target URL to spider', required: true },
    depth:     { type: 'number', default: 2, description: 'Spider depth (1-10)' },
    minLength: { type: 'number', default: 3, description: 'Minimum word length' },
    output:    { type: 'string', description: 'Output file path', required: false },
    withCount: { type: 'boolean', default: false, description: 'Include word frequency counts' },
    email:     { type: 'boolean', default: false, description: 'Include email addresses' },
    meta:      { type: 'boolean', default: false, description: 'Include meta/author words' },
  },
  requires: ['cewl'],
  risk: 'low',
  category: 'recon',
  handler: async (params, ctx) => {
    const outFile = params.output || `/tmp/cewl_${Date.now()}.txt`;
    const flags = `-d ${params.depth} -m ${params.minLength || 3}` +
      `${params.withCount ? ' -c' : ''}${params.withCount ? ' --with-count' : ''}` +
      `${params.email ? ' -e' : ''}${params.meta ? ' -a' : ''}`;
    await execSecure(`cewl ${params.url} ${flags} -w ${outFile}`, { timeout: 300000 });
    const words = (await execSecure(`wc -l < ${outFile}`)).stdout.trim();
    return { file: outFile, wordCount: parseInt(words), topWords: await getTopWords(outFile, 20) };
  },
};
```

## Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| url | string | yes |; | Target URL |
| depth | number | no | 2 | Spider depth |
| minLength | number | no | 3 | Minimum word length |
| output | string | no | auto | Output file |
| withCount | boolean | no | false | Include frequencies |
| email | boolean | no | false | Include emails |
| meta | boolean | no | false | Include meta tags |

## Workflow Chains
```
UPSTREAM:   02-amass (discovered URLs)
DOWNSTREAM: 20-hydra (password spraying), 21-john, 22-hashcat (cracking)
CHAINS:     cewl → hydra (targeted brute force with company-specific passwords)
            cewl → hashcat (rules-based mutations on company wordlist)
```

## Pitfalls
1. **Robot.txt**; respects robots.txt; may miss pages
2. **JavaScript SPAs**; doesn't render JS; misses dynamic content
3. **Rate limiting**; aggressive spidering triggers WAF blocks; use --delay
4. **Auth pages**; spider won't crawl behind login; provide cookies with --cookie
5. **Large sites**; depth 3+ on a large site can produce 100K+ words

## Verification
```bash
which cewl
cewl example.com -d 1 -m 5 -w /tmp/test_wordlist.txt && wc -l /tmp/test_wordlist.txt
```
