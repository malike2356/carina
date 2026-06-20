# Prompt 05: Red Team Automation Tools

## Context

Scout Monitor tier includes access to offensive security tools for authorized penetration
testing. Carina already has a tool registry; this prompt registers Metasploit, SQLMap,
Nikto, Nessus (if available), and Nuclei as orchestrated tools with approval gates.

All red team tools require: (1) Scout Monitor tier, (2) explicit user approval in TUI/web
before execution, (3) Scout event emission after use.

## What to Build

### 1. Metasploit tool

Create `src/tools/redteam/metasploit.ts`:
```typescript
export const metasploitTool = {
  name: 'metasploit',
  description: 'Run a Metasploit exploit module against an authorized target',
  requiresApproval: true,
  requiredTier: 'monitor',
  parameters: {
    module: { type: 'string', description: 'Metasploit module path (e.g. exploit/multi/handler)' },
    rhosts: { type: 'string', description: 'Target IP or hostname (must be authorized)' },
    rport: { type: 'number', optional: true },
    payload: { type: 'string', optional: true, description: 'Payload (e.g. linux/x64/meterpreter/reverse_tcp)' },
    options: { type: 'object', optional: true, description: 'Additional module options' },
  },
  async execute(args: MetasploitArgs) {
    const rc = generateRcFile(args);
    const result = await runShell(`msfconsole -q -r "${rc}" 2>&1`, { timeout: 120000 });
    return { output: result.stdout, exitCode: result.exitCode };
  },
};
```

The RC file approach (vs interactive) is safer: it sequences commands predictably and
exits cleanly when done.

### 2. SQLMap tool

Create `src/tools/redteam/sqlmap.ts`:
```typescript
export const sqlmapTool = {
  name: 'sqlmap',
  description: 'Test for SQL injection vulnerabilities on an authorized URL',
  requiresApproval: true,
  requiredTier: 'monitor',
  parameters: {
    url: { type: 'string', description: 'Target URL with parameter to test' },
    data: { type: 'string', optional: true, description: 'POST data string' },
    dbms: { type: 'string', optional: true, description: 'Target DBMS hint (mysql, mssql, postgres)' },
    level: { type: 'number', default: 1, description: 'Test level 1-5' },
    risk: { type: 'number', default: 1, description: 'Risk level 1-3' },
    outputDir: { type: 'string', optional: true },
  },
  async execute(args: SqlmapArgs) {
    const cmd = buildSqlmapCommand(args);
    const result = await runShell(cmd, { timeout: 300000 });
    return parseOutput(result.stdout);
  },
};
```

### 3. Nikto tool

```typescript
export const niktoTool = {
  name: 'nikto',
  description: 'Web server vulnerability scanner for authorized targets',
  requiresApproval: false,  // less dangerous than exploit tools
  requiredTier: 'monitor',
  parameters: {
    host: { type: 'string' },
    port: { type: 'number', default: 80 },
    ssl: { type: 'boolean', default: false },
    output: { type: 'string', optional: true, description: 'Output file path' },
  },
  async execute(args: NiktoArgs) {
    const outputFlag = args.output ? `-o "${args.output}"` : '';
    const sslFlag = args.ssl ? '-ssl' : '';
    const result = await runShell(`nikto -h "${args.host}" -p ${args.port} ${sslFlag} ${outputFlag}`, { timeout: 120000 });
    return { output: result.stdout };
  },
};
```

### 4. Nuclei tool

```typescript
export const nucleiTool = {
  name: 'nuclei',
  description: 'Template-based vulnerability scanner using the Nuclei engine',
  requiresApproval: false,
  requiredTier: 'monitor',
  parameters: {
    target: { type: 'string' },
    templates: { type: 'array', items: { type: 'string' }, optional: true, description: 'Template paths or tags' },
    severity: { type: 'string', optional: true, description: 'Filter by severity: critical,high,medium,low' },
  },
  async execute(args: NucleiArgs) {
    const templatesFlag = args.templates?.length ? `-t ${args.templates.join(',')}` : '-automatic-scan';
    const severityFlag = args.severity ? `-severity ${args.severity}` : '';
    const result = await runShell(`nuclei -u "${args.target}" ${templatesFlag} ${severityFlag} -json`, { timeout: 300000 });
    return parseNucleiJsonl(result.stdout);
  },
};
```

### 5. Skill pack for red team workflows

Create `src/skills/packs/red-team/index.ts` with skills:
- `recon-workflow` - enumerate target: nmap + nikto + nuclei in sequence
- `web-pentest` - test web app: nikto + sqlmap + custom checks
- `exploit-chain` - validate finding: nuclei confirm -> metasploit exploit -> meterpreter
- `report-finding` - document a finding in Scout and Obsidian

## Verification Checklist

- [ ] `carina tools list --category redteam` shows metasploit, sqlmap, nikto, nuclei
- [ ] `carina tools run nikto --args host=localhost` scans localhost (no approval needed)
- [ ] `carina tools run metasploit --args ...` shows approval prompt in TUI before running
- [ ] Scout shows `tool-approval` and `redteam-tool-run` events after metasploit use
- [ ] Free tier user sees "Scout Monitor required" message when attempting red team tools

## Files to Create or Modify

- CREATE `src/tools/redteam/metasploit.ts`
- CREATE `src/tools/redteam/sqlmap.ts`
- CREATE `src/tools/redteam/nikto.ts`
- CREATE `src/tools/redteam/nuclei.ts`
- CREATE `src/skills/packs/red-team/index.ts`
- MODIFY `src/tools/registry.ts` - register redteam toolset
