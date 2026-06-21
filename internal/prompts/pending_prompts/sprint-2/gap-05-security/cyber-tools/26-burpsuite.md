# Tool: burpsuite | #26 | Web Application Security Testing


## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`

## Metadata
- **Priority:** CRITICAL
- **Source:** Kali Linux
- **Binary:** `burpsuite` (Community/Pro), API via REST
- **Package:** `burpsuite`
- **Risk Level:** medium
- **Requires Human Approval:** no (for scanning)
- **OS Compatibility:** kali, parrot
- **Note:** Pro license needed for REST API (automated scanning). Community Edition is GUI-only.

## Purpose
Industry-standard web application security testing platform. Proxy, scanner, repeater, intruder, sequencer, decoder, and collaborator. Carina drives Burp Suite Pro's REST API for automated scanning, while using the proxy for manual traffic interception when needed by the operator.

## Carina CLI Command
```
carina web scan <url> [--mode passive|active] [--scope <regex>] [--config <file>]
carina web proxy start [--port 8080] [--intercept on|off]
```

## TypeScript Wrapper

```typescript
// Requires Burp Suite Pro with REST API enabled (User options → Misc → REST API)
const BURP_API = 'http://127.0.0.1:1337/v0.1';

export const burpScanTool: ToolDefinition = {
  name: 'burp_scan',
  description: 'Burp Suite automated web vulnerability scanning via REST API.',
  parameters: {
    url:       { type: 'string', description: 'Target URL', required: true },
    mode:      { type: 'enum', values: ['passive', 'active'], default: 'passive' },
    scope:     { type: 'string', description: 'Scope filter (regex)', required: false },
    loginUrl:  { type: 'string', description: 'Login URL for authenticated scanning', required: false },
    username:  { type: 'string', description: 'Login username', required: false },
    password:  { type: 'string', description: 'Login password', required: false },
    timeout:   { type: 'number', default: 1800, description: 'Max seconds' },
  },
  requires: ['burpsuite_pro'],
  risk: 'medium',
  category: 'web',
  handler: async (params, ctx) => {
    // 1. Add target to scope
    await curlPost(`${BURP_API}/target/scope`, { url: params.url, protocol: 'ANY' });
    // 2. Authenticate if needed
    if (params.loginUrl) {
      await curlPost(`${BURP_API}/auth/login`, {
        loginUrl: params.loginUrl, username: params.username, password: params.password
      });
    }
    // 3. Start scan
    const scan = await curlPost(`${BURP_API}/scan`, {
      urls: [params.url],
      scan_mode: params.mode === 'active' ? 'FULL' : 'PASSIVE',
    });
    // 4. Poll until complete
    let status = await curlGet(`${BURP_API}/scan/${scan.id}`);
    let elapsed = 0;
    while (status.scan_status !== 'succeeded' && elapsed < (params.timeout || 1800)) {
      await sleep(5000); elapsed += 5;
      status = await curlGet(`${BURP_API}/scan/${scan.id}`);
    }
    // 5. Get issues
    const issues = await curlGet(`${BURP_API}/scan/${scan.id}/issues`);
    return { scanId: scan.id, status: status.scan_status, issues, duration: elapsed };
  },
};

export const burpProxyTool: ToolDefinition = {
  name: 'burp_proxy',
  description: 'Start/stop/configure Burp Suite intercepting proxy.',
  parameters: {
    action:  { type: 'enum', values: ['start', 'stop', 'status'], required: true },
    port:    { type: 'number', default: 8080 },
    intercept: { type: 'boolean', default: false },
  },
  requires: ['burpsuite'],
  risk: 'low',
  category: 'web',
  handler: async (params, ctx) => {
    if (params.action === 'start') {
      await curlPut(`${BURP_API}/proxy`, { running: true, listen_port: params.port, intercept: params.intercept });
      return { proxy: `127.0.0.1:${params.port}`, status: 'running' };
    }
    const status = await curlGet(`${BURP_API}/proxy`);
    return status;
  },
};
```

## Parameters (Scan)
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| url | string | yes |; | Target URL |
| mode | enum | no | passive | Passive (safe) or active (intrusive) |
| scope | string | no |; | Scope filter |
| loginUrl | string | no |; | Login URL |
| username | string | no |; | Login user |
| password | string | no |; | Login password |
| timeout | number | no | 1800 | Max seconds |

## Workflow Chains
```
UPSTREAM:   15-whatweb (technology detection), 11-nuclei (initial vuln scan)
DOWNSTREAM: 13-sqlmap (SQLi exploitation), 27-ffuf (fuzzing)
CHAINS:     whatweb → burp active scan → sqlmap (exploit confirmed SQLi)
```

## Pitfalls
1. **Pro license required**; REST API is Pro-only ($449/year); Community is GUI-only
2. **Java memory**; Burp needs 2-4GB heap; set in `BurpSuitePro.vmoptions`
3. **Active scanning is intrusive**; sends malicious payloads; never scan production without auth
4. **REST API maturity**; API is newer and less stable than GUI; expect quirks
5. **Collaborator**; out-of-band detection needs Burp Collaborator server configured
6. **Scope management**; ensure scope excludes out-of-bounds URLs

## Verification
```bash
which burpsuite
# For API: curl http://127.0.0.1:1337/v0.1/health
```
