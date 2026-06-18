# Tool: yara | #45 | Pattern Matching Engine

## Metadata
- **Priority:** HIGH; **Source:** Kali; **Binary:** `yara`; **Package:** `yara`
- **Risk:** low; **Approval:** no; **OS:** all

## Purpose
Pattern matching swiss army knife for malware researchers. Creates and applies YARA rules; text or binary patterns; to identify and classify malware families, detect IOCs, and scan file systems. Carina uses YARA for automated malware triage with community + custom rulesets.

## Carina CLI Command
```
carina forensic yara <target> [--rules <dir>] [--recursive] [--timeout N]
```

## TypeScript Wrapper

```typescript
export const yaraTool: ToolDefinition = {
  name: 'yara_scan',
  description: 'Malware pattern matching; apply YARA rules to files, processes, and memory.',
  parameters: {
    target: { type: 'string', description: 'File, directory, or PID', required: true },
    rulesDir: { type: 'string', description: 'YARA rules directory', default: '/opt/yara-rules' },
    recursive: { type: 'boolean', default: true },
    timeout: { type: 'number', default: 60, description: 'Per-file timeout seconds' },
    tags: { type: 'array', items: 'string', description: 'Filter by rule tags' },
  },
  requires: ['yara'],
  risk: 'low',
  category: 'forensic',
  handler: async (params, ctx) => {
    const rFlag = params.recursive ? '-r' : '';
    const tagFlag = params.tags ? `-t ${params.tags.join(' -t ')}` : '';
    const cmd = `yara ${rFlag} -s --timeout ${params.timeout || 60} ${tagFlag} ${params.rulesDir} ${params.target}`;
    const result = await execSecure(cmd, { timeout: 3600000 });
    return parseYaraOutput(result.stdout);
  },
};
```

## Rule Sources
- `/opt/yara-rules/malware/`; Community rules (YARA-Forge, Neo23x0)
- `/opt/yara-rules/custom/`; Carina-generated rules from known samples
- `/opt/yara-rules/ioc/`; IOC-based rules (hashes, domains, IPs)

## Output
```
APT_MuddyWater [tag:apt, tag:iran] /opt/evidence/sample.exe
0x4a2:$string1: powershell -enc SQBFAFgA...
Ransomware_WannaCry [tag:ransomware] /opt/evidence/encrypted.bin
0x12f:$key: WNcry@2ol7
```

## Workflow Chains
```
UPSTREAM:   39-volatility3 (dumped processes)
DOWNSTREAM: 43-ghidra (deep analysis of flagged files)
```

## Pitfalls
1. **Rule quality**; old/loose rules produce false positives; keep rulesets updated
2. **Large scans**; recursive on filesystem roots without timeout can hang
3. **Binary patterns**; hex patterns can false-match legitimate software

## Verification
```bash
which yara && yara --version
echo 'rule test { condition: true }' > /tmp/test.yar
yara /tmp/test.yar /bin/ls
```
