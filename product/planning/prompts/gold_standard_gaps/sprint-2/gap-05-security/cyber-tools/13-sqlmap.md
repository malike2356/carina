# Tool: sqlmap | #13 | SQL Injection Automation

## Metadata
- **Priority:** CRITICAL
- **Source:** Kali Linux
- **Binary:** `sqlmap`
- **Package:** `sqlmap`
- **Risk Level:** high
- **Requires Human Approval:** yes (attempts exploitation)
- **OS Compatibility:** kali, parrot

## Purpose
Automated SQL injection detection and exploitation. Sqlmap identifies SQLi vulnerabilities, fingerprints the backend database, enumerates tables/columns, dumps data, and can execute OS commands via the database. The most powerful SQLi tool available; Carina uses it for both detection and validation.

## Carina CLI Command
```
carina vuln sqli <url> [--data "param=value"] [--cookie "..."] [--level 1-5] [--risk 1-3] [--dump]
```

## TypeScript Wrapper

```typescript
export const sqlmapTool: ToolDefinition = {
  name: 'sqlmap_scan',
  description: 'Automated SQL injection detection, exploitation, and data extraction.',
  parameters: {
    url:       { type: 'string', description: 'Target URL', required: true },
    data:      { type: 'string', description: 'POST data string', required: false },
    cookie:    { type: 'string', description: 'Session cookie', required: false },
    level:     { type: 'number', default: 1, description: 'Test depth 1-5' },
    risk:      { type: 'number', default: 1, description: 'Risk 1-3 (3=UPDATE/DELETE)' },
    dump:      { type: 'boolean', default: false, description: 'Automatically dump found tables' },
    dbms:      { type: 'string', description: 'Force specific DBMS (mysql, postgres, mssql, oracle)', required: false },
    technique: { type: 'string', description: 'SQLi technique: B,E,U,S,T,Q', default: 'BEUSTQ' },
    batch:     { type: 'boolean', default: true, description: 'Non-interactive mode' },
  },
  requires: ['sqlmap'],
  risk: 'high',
  category: 'vuln',
  requiresApproval: true,
  handler: async (params, ctx) => {
    if (params.risk >= 3) await ctx.requestApproval('High-risk SQLi: may modify/delete data');
    let cmd = `sqlmap -u "${params.url}" --level ${params.level} --risk ${params.risk} --technique=${params.technique}`;
    if (params.data) cmd += ` --data="${params.data}"`;
    if (params.cookie) cmd += ` --cookie="${params.cookie}"`;
    if (params.dbms) cmd += ` --dbms=${params.dbms}`;
    if (params.dump) cmd += ' --dump';
    if (params.batch) cmd += ' --batch';
    cmd += ' --output-dir=/tmp/sqlmap_scan --json';
    const result = await execSecure(cmd, { timeout: 600000 });
    return parseSqlmapOutput('/tmp/sqlmap_scan');
  },
};
```

## Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| url | string | yes |; | Target URL |
| data | string | no |; | POST data |
| cookie | string | no |; | Session cookie |
| level | number | no | 1 | Tests depth (1=basic, 5=exhaustive) |
| risk | number | no | 1 | 1=low, 2=medium (heavy time-based), 3=OR-based UPDATE |
| dump | boolean | no | false | Auto-dump tables |
| dbms | string | no |; | Force backend type |
| technique | string | no | BEUSTQ | B=Boolean, E=Error, U=Union, S=Stacked, T=Time, Q=Inline |
| batch | boolean | no | true | Non-interactive |

## Injection Techniques
| Letter | Technique | Speed | Stealth |
|--------|-----------|-------|---------|
| B | Boolean-based blind | Slow | High |
| E | Error-based | Fast | Low |
| U | UNION query | Fast | Low |
| S | Stacked queries | Fast | Low |
| T | Time-based blind | Very slow | Medium |
| Q | Inline queries | Fast | Low |

## Workflow Chains
```
UPSTREAM:   27-ffuf (parameter discovery), 31-arjun (hidden params)
DOWNSTREAM: 18-metasploit (OS command execution via SQL), 71-stix (report generation)
```

## Pitfalls
1. **Data destruction**; risk=3 can UPDATE/DELETE data; ALWAYS test on staging
2. **WAF bypass**; use --tamper scripts for WAF evasion (e.g. space2comment, between)
3. **Performance**; level=5 with technique=BEUSTQ on a large DB can take hours
4. **Encoding**; URLs with special chars must be quoted
5. **CSRF tokens**; needs --csrf-token and --csrf-url for modern apps
6. **Second-order SQLi**; sqlmap cannot detect second-order injection alone

## Verification
```bash
which sqlmap && sqlmap --version
sqlmap -u "http://testphp.vulnweb.com/artists.php?artist=1" --batch --level 1 --risk 1 --timeout 30
```
