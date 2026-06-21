# Tool: sherlock | #06 | Username OSINT


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
- **Binary:** `sherlock`
- **Package:** `sherlock`
- **Risk Level:** low
- **Requires Human Approval:** no
- **OS Compatibility:** kali, parrot, any

## Purpose
Username search across 300+ social networks and websites. Input a username, Sherlock checks if it exists on Twitter, Instagram, GitHub, Reddit, TikTok, and hundreds of other platforms; revealing an individual's digital footprint. Critical for social engineering reconnaissance and identity mapping.

## Carina CLI Command
```
carina recon username <username> [--sites all|social|dev|adult-filtered] [--timeout N]
```

## TypeScript Wrapper

```typescript
export const sherlockTool: ToolDefinition = {
  name: 'sherlock_search',
  description: 'Username search across 300+ social networks and websites.',
  parameters: {
    username:    { type: 'string', description: 'Username to search', required: true },
    sites:       { type: 'enum', values: ['all', 'social', 'dev', 'nsfw'], default: 'all' },
    timeout:     { type: 'number', default: 60, description: 'Per-site timeout in seconds' },
    tor:         { type: 'boolean', default: false, description: 'Route through Tor' },
  },
  requires: ['sherlock'],
  risk: 'low',
  category: 'recon',
  handler: async (params, ctx) => {
    let cmd = `sherlock ${params.username} --timeout ${params.timeout || 60} --print-found --csv`;
    if (params.tor) cmd += ' --tor';
    const result = await execSecure(cmd, { timeout: 600000 });
    return parseSherlockCsv(result.stdout);
  },
};
```

## Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| username | string | yes |; | Username to search |
| sites | enum | no | all | all/social/dev (filter NSFW) |
| timeout | number | no | 60 | Per-site timeout seconds |
| tor | boolean | no | false | Route through Tor |

## Workflow Chains
```
UPSTREAM:   03-theHarvester (email → extract username)
DOWNSTREAM: 07-maltego (social graph enrichment)
```

## Structured Output
```json
{
  "username": "johndoe",
  "found": 23,
  "profiles": [
    { "site": "Twitter", "url": "https://twitter.com/johndoe" },
    { "site": "GitHub", "url": "https://github.com/johndoe" },
    { "site": "Reddit", "url": "https://reddit.com/user/johndoe" },
    { "site": "Instagram", "url": "https://instagram.com/johndoe" }
  ],
  "notFound": 287
}
```

## Pitfalls
1. **Rate limiting**; 300 requests triggers blocks; use Tor or VPN rotation
2. **NSFW sites**; default search includes adult sites; filter for corporate use
3. **False negatives**; some sites block automated checks; results not exhaustive
4. **Python dependencies**; requires `requests`, `torrequest` (for Tor)
5. **Slow**; 300 sites × 2 seconds each = 10 minutes minimum

## Verification
```bash
which sherlock
sherlock testuser --timeout 5 --print-found 2>/dev/null | head -10
```
