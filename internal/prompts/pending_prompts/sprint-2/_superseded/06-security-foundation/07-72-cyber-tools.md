# Prompt 07: Register All 72 Cyber Tools in Tool Registry


## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`

## Context

`core.carinaai.uk/CLAUDE.md` cites 71 tools. The gap between 71 (verified) and the "72 cyber
tools" claim needs to be closed by auditing the tool registry and ensuring all documented
cyber tools are registered, have correct descriptions, and are gated by the right tier.

## What to Build

### 1. Audit current tool registry

Read `src/tools/registry.ts` and list all TOOLSET_MAP entries. For each tool:
- Verify a corresponding implementation file exists
- Check the tool has a name, description, parameters, and execute function
- Check it is in the right category (recon, exploit, forensics, analysis, etc.)

### 2. Categorize tools

Target categorization (72 tools across these categories):

| Category | Target Count | Examples |
|----------|-------------|---------|
| Recon | 12 | nmap, whois, dig, shodan, amass, subfinder, theHarvester, dnsx, httpx, whatweb, wappalyzer, crtsh |
| Web Vuln | 10 | nikto, sqlmap, nuclei, zaproxy, wfuzz, ffuf, dirb, gobuster, burp-passive, sslyze |
| Exploit | 8 | metasploit, sqlmap-exploit, searchsploit, exploitdb-api, msfvenom, powershell-empire (stub), cobalt-strike-stub, caldera-stub |
| Forensics | 8 | dc3dd, volatility, bulk-extractor, plaso, timesketch-upload, autopsy-api, strings-analysis, hexdump |
| Network | 8 | wireshark-cap, tcpdump, netcat, masscan, zmap, arpwatch, p0f, netstat-mon |
| Crypto | 6 | hashcat, john, openssl-sign, openssl-verify, age-encrypt, age-decrypt |
| OSINT | 6 | maltego-api, shodan-search, google-dork, linkedin-scrape-stub, pastebin-monitor, breach-check |
| Compliance | 6 | scout-report, soc2-evidence, cis-benchmark, gdpr-check, pci-scan, iso27001-check |
| Utility | 8 | read-file, write-file, run-command, web-search, web-fetch, screenshot, pdf-parse, json-transform |

Total: 72

### 3. Stub pattern for tools not yet installed

For tools that require external binaries not always installed (maltego, cobalt-strike, etc.),
use a stub pattern:
```typescript
export const malteoApiTool = {
  name: 'maltego-api',
  description: 'Query Maltego iTDS for entity relationship data (requires Maltego API key)',
  requiredEnv: ['MALTEGO_API_KEY'],
  async execute(args: any) {
    if (!process.env.MALTEGO_API_KEY) {
      return { error: 'MALTEGO_API_KEY not set. See docs for setup.' };
    }
    // implementation
  },
};
```

The tool is registered and usable by those who have the binary/key. It returns a helpful
error message to everyone else instead of crashing.

### 4. Update TOOLSET_MAP

After auditing and filling gaps:
```typescript
export const TOOLSET_MAP = {
  recon: [nmapTool, whoisTool, digTool, ...],
  webVuln: [niktoTool, sqlmapTool, nucleiTool, ...],
  exploit: [metasploitTool, ...],
  forensics: [forensicsPipelineTool, collectEvidenceTool, ...],
  network: [...],
  crypto: [...],
  osint: [...],
  compliance: [...],
  utility: [readFileTool, writeFileTool, runCommandTool, ...],
};
```

### 5. Update CLAUDE.md metrics

After running `pnpm check:capabilities`, update `CLAUDE.md`:
```
## Verified product metrics (2026-06-19)
Run from `core.carinaai.uk`: `pnpm test` (...), TOOLSET_MAP (72 tools), ...
```

## Verification Checklist

- [ ] `carina tools list` shows 72 tools across all categories
- [ ] `carina tools list --category recon` shows 12 tools
- [ ] Each tool has name, description, at least one parameter, and execute function
- [ ] `pnpm check:capabilities` passes with tools: 72
- [ ] CLAUDE.md metrics updated to reflect 72 tools

## Files to Create or Modify

- MODIFY `src/tools/registry.ts` - expand TOOLSET_MAP to 72 tools
- CREATE missing tool implementation files in each category
- MODIFY `core.carinaai.uk/CLAUDE.md` - update verified metrics
- MODIFY `scripts/capability-claims.json` - update tools claimed count to 72
