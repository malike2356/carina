# Tool: snort | #67 | Intrusion Detection System

**Source:** Kali | **Binary:** `snort` | **Package:** `snort` | **Risk:** low | **Approval:** no

Network intrusion detection/prevention system (IDS/IPS). Analyzes traffic in real-time against rule sets to detect attacks, probes, and malware. Carina uses Snort for continuous network monitoring and automated alert triage; the only blue team defense tool in this batch.

## CLI: `carina blue monitor --engine snort <interface> [--rules <dir>] [--alert-fast]`

## Wrapper
```typescript
export const snortTool: ToolDefinition = {
  name: 'snort_monitor',
  description: 'IDS/IPS; real-time traffic analysis with 30K+ rules.',
  parameters: {
    interface: { type: 'string', required: true },
    rulesDir: { type: 'string', default: '/etc/snort/rules' },
    configFile: { type: 'string', default: '/etc/snort/snort.conf' },
    alertMode: { type: 'enum', values: ['fast', 'full', 'console', 'json'], default: 'json' },
    threshold: { type: 'number', default: 0, description: 'Minimum priority to log' },
  },
  requires: ['snort'],
  risk: 'low',
  category: 'blue',
  handler: async (params, ctx) => {
    const cmd = `snort -i ${params.interface} -c ${params.configFile} -A ${params.alertMode} ` +
      `--daq-dir /usr/lib/daq -l /var/log/snort`;
    const result = await execSecure(cmd, { timeout: 86400000, background: true });
    return { monitorStarted: true, logDir: '/var/log/snort', pid: result.pid };
  },
};
```

Rule Sources: Emerging Threats, Talos, community rules, custom Carina rules from YARA conversions.

Pitfalls: Needs tuned for each network; false positives flood logs; performance degrades on high-bandwidth links.
Verify: `which snort && snort -V`

---
# Tool: bloodhound | #68 | Active Directory Attack Path Mapping

**Source:** Kali | **Binary:** `bloodhound-python` | **Package:** `bloodhound` | **Risk:** medium | **Approval:** no (data collection only)

Active Directory attack path analysis. Maps trust relationships, group memberships, ACLs, and session data to find the shortest path to Domain Admin. Carina uses BloodHound for AD security assessment; identifying privilege escalation paths.

## CLI: `carina blue ad-map <domain> [--username <user> --password <pass>|--hash <ntlm>] [--collection-method all|session|group|acl]`

## Wrapper
```typescript
export const bloodhoundTool: ToolDefinition = {
  name: 'bloodhound_map',
  description: 'AD attack path analysis; find paths to Domain Admin via graph theory.',
  parameters: {
    domain: { type: 'string', required: true },
    username: { type: 'string', required: true },
    password: { type: 'string', required: false },
    hash: { type: 'string', required: false },
    dc: { type: 'string', description: 'Domain Controller IP' },
    collectionMethod: { type: 'array', items: 'string', default: ['Default'] },
    outputDir: { type: 'string', required: true },
  },
  requires: ['bloodhound-python'],
  risk: 'medium',
  category: 'blue',
  handler: async (params, ctx) => {
    const passFlag = params.hash ? `--hashes :${params.hash}` : `-p '${params.password}'`;
    const dcFlag = params.dc ? `-dc ${params.dc}` : '';
    const collFlag = `-c ${params.collectionMethod.join(',')}`;
    const cmd = `bloodhound-python -d ${params.domain} -u ${params.username} ${passFlag} ${dcFlag} ${collFlag} --zip -o ${params.outputDir}`;
    const result = await execSecure(cmd, { timeout: 3600000 });
    return { outputDir: params.outputDir };
  },
};
```

Collection Methods: `Default` (all), `Session` (logged-on users), `Group` (group memberships), `ACL` (permissions), `Trusts` (domain trusts), `DCOM` (Distributed COM)

Pitfalls: ATA/Azure ATP detects BloodHound data collection; use sharp-hound for stealth.
Verify: `which bloodhound-python`

---
# Tool: log2timeline | #69 | Super Timeline Creation

**Source:** CSI | **Binary:** `log2timeline.py` (plaso) | **Package:** `plaso` | **Risk:** low | **Approval:** no

Creates super timelines from disk images, aggregating timestamps from filesystem, registry, event logs, prefetch, browser history, and 100+ artifact sources. Carina uses it for incident timeline reconstruction.

## CLI: `carina forensic timeline <image> [--output <file>] [--parsers <list>]`

## Wrapper
```typescript
export const log2timelineTool: ToolDefinition = {
  name: 'log2timeline_create',
  description: 'Super timeline; 100+ artifact sources into unified event stream.',
  parameters: {
    image: { type: 'string', required: true },
    outputFile: { type: 'string', description: 'Plaso storage file (.plaso)', required: true },
    parsers: { type: 'array', items: 'string' },
    partition: { type: 'string', default: 'all' },
  },
  requires: ['log2timeline.py'],
  risk: 'low',
  category: 'reporting',
  handler: async (params, ctx) => {
    const pFlag = params.parsers ? `--parsers ${params.parsers.join(',')}` : '';
    const cmd = `log2timeline.py ${pFlag} --partitions ${params.partition} ${params.outputFile} ${params.image}`;
    await execSecure(cmd, { timeout: 86400000 });
    return { plasoFile: params.outputFile };
  },
};
```

Verify: `which log2timeline.py`

---
# Tool: timesketch | #70 | Collaborative Timeline Analysis

**Source:** CSI | **Binary:** Web app (API-driven) | **Package:** `timesketch` | **Risk:** low | **Approval:** no

Web-based collaborative forensic timeline analysis platform. Ingests plaso timelines, provides search, filtering, tagging, and graph visualization. Carina drives Timesketch API for automated timeline querying.

## CLI: `carina forensic search <query> [--timeline <id>] [--time-start <ISO> --time-end <ISO>]`

## Wrapper
```typescript
export const timesketchTool: ToolDefinition = {
  name: 'timesketch_query',
  description: 'Forensic timeline search; query plaso timelines via REST API.',
  parameters: {
    query: { type: 'string', description: 'Search query (Lucene syntax)', required: true },
    timelineId: { type: 'number' },
    timeStart: { type: 'string', description: 'ISO timestamp' },
    timeEnd: { type: 'string', description: 'ISO timestamp' },
    limit: { type: 'number', default: 100 },
  },
  requires: ['timesketch_server'],
  risk: 'low',
  category: 'reporting',
  handler: async (params, ctx) => {
    const url = `http://127.0.0.1:5000/api/v1/sketches/1/explore/`;
    const body = { query: params.query, filter: { limit: params.limit } };
    const result = await fetch(url, { method: 'POST', body: JSON.stringify(body) });
    return result.json();
  },
};
```

Pitfalls: Needs Timesketch server running (docker); ElasticSearch backend required.
Verify: `curl -s http://127.0.0.1:5000/api/v1/`

---
# Tool: stix | #71 | Threat Intelligence Export

**Source:** CSI | **Binary:** `stix2` (Python library) | **Package:** `python3-stix2` | **Risk:** low | **Approval:** no

Structured Threat Information eXpression (STIX 2.1); standardized threat intelligence format. Carina exports findings as STIX bundles for sharing with TIPs, ISACs, and MISP instances.

## CLI: `carina report stix <engagement-id> [--output <file>] [--ttp <id>]`

## Wrapper
```typescript
export const stixTool: ToolDefinition = {
  name: 'stix_export',
  description: 'Export findings as STIX 2.1 bundles for threat intelligence sharing.',
  parameters: {
    findings: { type: 'array', items: 'object', required: true, description: 'Carina finding objects' },
    outputFile: { type: 'string', required: true },
    tlp: { type: 'enum', values: ['white', 'green', 'amber', 'red'], default: 'amber' },
    author: { type: 'string', default: 'Carina Scout' },
  },
  requires: ['python3-stix2'],
  risk: 'low',
  category: 'reporting',
  handler: async (params, ctx) => {
    const script = `
import json, stix2
bundle = stix2.Bundle(objects=[
    stix2.Indicator(name=f['name'], pattern=f['pattern'], pattern_type='stix')
    for f in ${json.dumps(params.findings)}
])
with open('${params.outputFile}', 'w') as f:
    f.write(bundle.serialize(pretty=True))
`;
    await execSecure(`python3 -c "${script}"`);
    return { stixFile: params.outputFile, findingsCount: params.findings.length };
  },
};
```

Verify: `python3 -c "import stix2; print(stix2.__version__)"`

---
# Tool: cyberchef | #72 | The Cyber Swiss Army Knife

**Source:** CSI | **Binary:** Web app (local) | **Package:** `cyberchef` | **Risk:** low | **Approval:** no

300+ data transformation operations in a browser or CLI. Base64, hex, encryption, compression, encoding, hashing, parsing, and data analysis. Carina uses CyberChef programmatically for data transformation pipelines.

## CLI: `carina analyze transform <data|file> --recipe "From Hex,To Base64" [--output <file>]`

## Wrapper
```typescript
export const cyberchefTool: ToolDefinition = {
  name: 'cyberchef_transform',
  description: '300+ data ops; encoding, encryption, compression, parsing, analysis.',
  parameters: {
    input: { type: 'string', description: 'Input data or file path', required: true },
    recipe: { type: 'string', description: 'Comma-separated operation list (e.g., "From Base64,Decode text")', required: true },
    inputFromFile: { type: 'boolean', default: false },
    outputFile: { type: 'string' },
  },
  requires: ['cyberchef'],
  risk: 'low',
  category: 'reporting',
  handler: async (params, ctx) => {
    const input = params.inputFromFile ? await readFile(params.input) : params.input;
    const recipeOps = params.recipe.split(',').map(s => s.trim());
    const body = JSON.stringify({ input, recipe: recipeOps.map(op => ({ op })) });
    const result = await fetch('http://127.0.0.1:3000/bake', { method: 'POST', body });
    const data = await result.json();
    return { output: data.value, recipe: recipeOps };
  },
};
```

Sample Recipes:
- `From Base64, Decode text`; Base64 decode
- `From Hex, To Decimal`; Hex to decimal
- `XOR({'key':'secret'}), To Hex`; XOR with key
- `Extract email addresses`; Regex email extraction
- `Parse ASN.1 hex string`; ASN.1 parsing

Pitfalls: Requires local CyberChef server on port 3000; large inputs timeout.
Verify: `curl -s http://127.0.0.1:3000/ | head -5`
