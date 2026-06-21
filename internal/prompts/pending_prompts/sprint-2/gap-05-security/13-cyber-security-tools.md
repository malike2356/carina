# Carina Cyber Security & Forensics Agent; OS Tool Adoption

**Date:** 2026-06-17
**Purpose:** Adopt tools from Kali Linux, Parrot OS, and CSI Linux to make Carina the ultimate autonomous cyber security and forensics agent for blue teams, pen testers, and bug bounty hunters.
**Source:** Kali Linux (102 tools cataloged), Parrot OS, CSI Linux
**Target:** Carina becomes the agent that security professionals run inside their terminal; autonomous reconnaissance, exploitation validation, forensics, and reporting.

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## EXECUTIVE SUMMARY

**102 Kali Linux tools identified. 60+ Parrot OS tools. 50+ CSI Linux forensics tools.** From these, **47 tools can be adopted into Carina as autonomous agent capabilities.** The key insight: most security tools are CLI-based with structured output; perfect for agent automation. Carina can chain reconnaissance → vulnerability scanning → exploitation validation → reporting, all autonomously.

---

## 1. KALI LINUX TOOLS; ADOPTABLE FOR CARINA

### 1.1 Reconnaissance & OSINT (8 tools)

| Tool | Purpose | Carina Integration | Priority |
|------|---------|-------------------|----------|
| **nmap** | Network discovery, port scanning | `carina recon scan <target>` → autonomous port scan, service detection, OS fingerprinting | CRITICAL |
| **amass** | Subdomain enumeration, attack surface mapping | `carina recon subdomains <domain>` → passive + active enumeration | CRITICAL |
| **theHarvester** | Email, subdomain, name gathering | `carina recon osint <domain>` → automated OSINT gathering | HIGH |
| **recon-ng** | Web reconnaissance framework | Structured recon modules, agent-driven workflow | HIGH |
| **spiderfoot** | Automated OSINT automation | 200+ modules, agent can orchestrate | HIGH |
| **sherlock** | Username search across 300+ sites | `carina recon username <name>` → find social profiles | MEDIUM |
| **maltego** | Graph-based OSINT, entity mapping | Visual link analysis, agent can drive queries | MEDIUM |
| **dmitry** | Deepmagic Information Gathering | All-in-one: whois, subdomain, port scan, banner grab | MEDIUM |

### 1.2 Vulnerability Scanning (7 tools)

| Tool | Purpose | Carina Integration | Priority |
|------|---------|-------------------|----------|
| **nuclei** | Template-based vulnerability scanning | `carina vuln scan <target>` → run nuclei with auto-generated templates | CRITICAL |
| **nikto** | Web server scanner | `carina vuln web <target>` → comprehensive web server assessment | CRITICAL |
| **sqlmap** | Automated SQL injection | `carina vuln sqli <target>` → detect + exploit SQL injection | CRITICAL |
| **wpscan** | WordPress security scanner | `carina vuln wordpress <site>` → plugin/theme/user enumeration | HIGH |
| **whatweb** | Web technology fingerprinting | Identify CMS, frameworks, server software | MEDIUM |
| **yersinia** | Layer 2 attack framework | Network protocol vulnerability assessment | MEDIUM |
| **legion** | Semi-automated network pen testing | Fork of Sparta; agent-driven network assessment | MEDIUM |

### 1.3 Exploitation & Post-Exploitation (8 tools)

| Tool | Purpose | Carina Integration | Priority |
|------|---------|-------------------|----------|
| **metasploit-framework** | Exploitation framework | `carina exploit run <module> <target>`; agent selects and executes modules | CRITICAL |
| **impacket-scripts** | Windows network protocol tools | SMB/DCERPC/WMI exploitation, agent-driven | HIGH |
| **hydra** | Network login brute-forcer | `carina brute service <target>`; multi-protocol brute force | HIGH |
| **john** | Password cracker | `carina crack hash <file>`; John + hashcat orchestration | HIGH |
| **hashcat** | GPU-accelerated password cracking | `carina crack gpu <hash>`; harness GPU power | HIGH |
| **evil-winrm** | Windows Remote Management shell | Post-exploitation Windows access | MEDIUM |
| **crackmapexec** | Swiss army knife for pentesting networks | SMB/WinRM/MSSQL enumeration + exploitation | MEDIUM |
| **mimikatz** | Windows credential extraction | Post-exploitation credential harvesting | MEDIUM |

### 1.4 Web Application Testing (7 tools)

| Tool | Purpose | Carina Integration | Priority |
|------|---------|-------------------|----------|
| **burpsuite** | Web application security testing | Proxy + scanner + repeater; agent can drive API | CRITICAL |
| **ffuf** | Fast web fuzzer | `carina fuzz dirs <url>` `carina fuzz params <url>` | CRITICAL |
| **dirsearch** | Web path scanner | Directory/file enumeration | HIGH |
| **feroxbuster** | Recursive content discovery | Forced browsing with recursion | HIGH |
| **gobuster** | Directory/file/DNS busting | Multi-mode brute forcing | HIGH |
| **arjun** | HTTP parameter discovery | Find hidden GET/POST parameters | MEDIUM |
| **sstimap** | SSTI detection and exploitation | Server-Side Template Injection testing | MEDIUM |

### 1.5 Wireless & Network (5 tools)

| Tool | Purpose | Carina Integration | Priority |
|------|---------|-------------------|----------|
| **aircrack-ng** | WiFi security auditing | `carina wireless audit <interface>`; WPA/WEP cracking | HIGH |
| **bettercap** | MITM framework | Network attacks, monitoring, credential harvesting | HIGH |
| **kismet** | Wireless network detector | Passive WiFi + Bluetooth monitoring | MEDIUM |
| **wifite** | Automated WiFi attack tool | WPS + WPA attacks, automated workflow | MEDIUM |
| **ettercap** | MITM attack suite | ARP poisoning, credential sniffing | MEDIUM |

### 1.6 Forensics & Reverse Engineering (6 tools)

| Tool | Purpose | Carina Integration | Priority |
|------|---------|-------------------|----------|
| **autopsy** | Digital forensics platform | `carina forensic autopsy <image>`; timeline, file analysis | CRITICAL |
| **binwalk** | Firmware analysis | Extract filesystems from firmware images | HIGH |
| **ghidra** | NSA reverse engineering framework | Decompile + analyze binaries | HIGH |
| **bulk-extractor** | Bulk data extraction | Extract emails, URLs, credit cards from disk images | HIGH |
| **yara** | Pattern matching swiss army knife | `carina forensic yara <target> <rules>`; malware identification | HIGH |
| **ollydbg** | Windows debugger | Binary analysis | MEDIUM |

### 1.7 Sniffing & Traffic Analysis (4 tools)

| Tool | Purpose | Carina Integration | Priority |
|------|---------|-------------------|----------|
| **wireshark** | Network protocol analyzer | `carina analyze pcap <file>`; automated traffic analysis | CRITICAL |
| **tcpdump** | Command-line packet analyzer | Traffic capture + analysis | HIGH |
| **dsniff** | Network auditing toolkit | Password sniffing, ARP spoofing | MEDIUM |
| **responder** | LLMNR/NBT-NS/mDNS poisoner | Credential harvesting on Windows networks | MEDIUM |

---

## 2. PARROT OS TOOLS; ADOPTABLE FOR CARINA

Parrot OS shares many tools with Kali but adds unique ones focused on privacy, development, and lightweight alternatives.

### 2.1 Parrot-Unique Tools (6 tools)

| Tool | Purpose | Carina Integration | Priority |
|------|---------|-------------------|----------|
| **anonsurf** | Anonymous routing via Tor | `carina privacy tor on`; route all traffic through Tor | HIGH |
| **tor** | Anonymity network | Built-in for privacy-preserving recon | HIGH |
| **gparted** | Disk partition editor | Forensic disk imaging and partitioning | MEDIUM |
| **cutter** | Reverse engineering platform | Rizin-based; lighter than Ghidra | MEDIUM |
| **bleachbit** | System cleaner / anti-forensics | Secure data deletion for opsec | MEDIUM |
| **mat2** | Metadata anonymization toolkit | `carina privacy strip <file>`; remove EXIF/metadata | HIGH |

### 2.2 Development & Custom Tooling (4 tools)

| Tool | Purpose | Carina Integration | Priority |
|------|---------|-------------------|----------|
| **vscodium** | VS Code without telemetry | Security-focused IDE for custom exploit dev | MEDIUM |
| **geany** | Lightweight IDE | Quick script editing during engagements | LOW |
| **scapy** | Packet manipulation | `carina network craft`; build custom packets | HIGH |
| **radare2** | Reverse engineering framework | Binary analysis, disassembly | HIGH |

---

## 3. CSI LINUX TOOLS; ADOPTABLE FOR CARINA FORENSICS

CSI Linux is purpose-built for digital forensics and incident response. Its tools are the gold standard for forensics.

### 3.1 Disk & Memory Forensics (5 tools)

| Tool | Purpose | Carina Integration | Priority |
|------|---------|-------------------|----------|
| **dc3dd** | DoD patched dd for forensic imaging | `carina forensic image <disk>`; forensically sound disk imaging | CRITICAL |
| **guymager** | Forensic imager with GUI | Drive imaging with hash verification | HIGH |
| **volatility3** | Memory forensics framework | `carina forensic memory <dump>`; process/network/registry analysis | CRITICAL |
| **rekall** | Memory analysis framework | Alternative to Volatility; agent-driven analysis | HIGH |
| **foremost** | File carving from disk images | Recover deleted files from raw images | HIGH |

### 3.2 File System & Evidence Analysis (5 tools)

| Tool | Purpose | Carina Integration | Priority |
|------|---------|-------------------|----------|
| **sleuthkit** | File system forensics toolkit | `carina forensic ts <image>`; inode/block/file analysis | CRITICAL |
| **plasmo** | Evidence collector | `carina forensic collect <target>`; gather forensic artifacts | HIGH |
| **xplico** | Network forensics analysis | Extract application data from pcap | HIGH |
| **regripper** | Windows registry forensics | `carina forensic registry <hive>`; extract artifacts | HIGH |
| **hashdeep** | Compute/audit hash sets | `carina forensic hash <dir>`; verify file integrity | HIGH |

### 3.3 Timeline & Reporting (4 tools)

| Tool | Purpose | Carina Integration | Priority |
|------|---------|-------------------|----------|
| **log2timeline** | Super timeline creation | `carina forensic timeline <evidence>`; unified timeline | CRITICAL |
| **timesketch** | Collaborative forensic timeline analysis | Web-based timeline visualization; agent can drive API | HIGH |
| **stix** | Structured Threat Information eXpression | `carina report stix <threat>`; standardized threat intel | HIGH |
| **cyberchef** | The Cyber Swiss Army Knife | `carina analyze transform <data>`; 300+ operations | CRITICAL |

---

## 4. HOW CARINA ORCHESTRATES THESE TOOLS

### 4.1 The Autonomous Workflow

```
1. RECON
   carina recon scan example.com
     → nmap: port scan + service detection
     → amass: subdomain enumeration  
     → theHarvester: OSINT gathering
     → spiderfoot: automated recon
     → Report: attack surface map

2. VULNERABILITY ASSESSMENT
   carina vuln assess example.com
     → nuclei: template-based scanning
     → nikto: web server assessment
     → sqlmap: SQL injection testing
     → wpscan: WordPress testing (if detected)
     → Report: ranked vulnerability list with CVSS scores

3. EXPLOITATION VALIDATION
   carina exploit validate example.com --vuln CVE-2024-xxxx
     → metasploit: attempt exploitation
     → impacket: Windows exploitation if applicable
     → Report: confirmed exploitable, proof screenshot, remediation

4. POST-EXPLOITATION
   carina post gather <session>
     → mimikatz: credential extraction
     → bloodhound: AD attack path mapping
     → Report: compromised assets, lateral movement paths

5. REPORTING
   carina report generate <engagement-id>
     → Executive summary
     → Technical findings with evidence
     → Remediation recommendations
     → STIX threat intelligence export
     → PDF/HTML/JSON output
```

### 4.2 Blue Team Workflows

```
carina blue monitor
  → Continuous network monitoring with snort/suricata rules
  → Log analysis with timesketch integration
  → Suspicious activity alerting
  → Automated incident response playbooks

carina blue hunt <ioc>
  → Threat hunting across network + endpoints
  → YARA rule execution across file systems
  → Memory analysis with volatility
  → Timeline reconstruction with log2timeline

carina forensic case <case-id>
  → Disk imaging with dc3dd (forensically sound)
  → Memory capture with volatility
  → File carving with foremost
  → Registry analysis with regripper
  → Super timeline with log2timeline
  → Case report with chain of custody
```

### 4.3 Bug Bounty Workflows

```
carina bounty recon <target>
  → Automated subdomain discovery
  → Technology fingerprinting
  → Parameter discovery
  → JavaScript analysis for endpoints

carina bounty scan <target>
  → Nuclei template scan (community + custom)
  → Custom fuzzing with ffuf
  → SQL injection testing
  → XSS/CSRF/SSRF testing

carina bounty report <finding>
  → Generate HackerOne/Bugcrowd formatted report
  → Include proof of concept
  → CVSS scoring
  → Remediation guidance
```

---

## 5. IMPLEMENTATION ARCHITECTURE

### 5.1 Tool Wrapper Pattern

Each adopted tool gets a Carina tool wrapper:

```typescript
// tools/security/nmap.ts

export const nmapTool: ToolDefinition = {
  name: 'nmap_scan',
  description: 'Network discovery and port scanning via nmap. ' +
    'Scan types: quick (top 1000 ports), full (all ports), ' +
    'stealth (SYN scan), service (version detection), os (OS fingerprint).',
  parameters: {
    target: { type: 'string', description: 'IP, hostname, or CIDR range' },
    scanType: { type: 'enum', values: ['quick', 'full', 'stealth', 'service', 'os', 'vuln'] },
    options: { type: 'string', description: 'Additional nmap flags', optional: true },
  },
  requires: ['nmap'],  // Tool availability check
  risk: 'medium',      // Recon is medium risk
  handler: async (params) => {
    // Build nmap command
    const flags = SCAN_TYPE_FLAGS[params.scanType];
    const cmd = `nmap ${flags} ${params.options || ''} ${params.target}`;
    
    // Execute with timeout
    const result = await execSecure(cmd, { timeout: 300000 });
    
    // Parse output to structured format
    return parseNmapOutput(result.stdout);
  },
};
```

### 5.2 Tool Availability Detection

```typescript
// tools/security/tool-availability.ts

interface SecurityTool {
  name: string;
  package: string; // apt package name
  binary: string; // executable to check
  category: 'recon' | 'vuln' | 'exploit' | 'forensic' | 'wireless' | 'web';
  os: ('kali' | 'parrot' | 'csi' | 'any')[];
}

const SECURITY_TOOLS: SecurityTool[] = [
  { name: 'nmap', package: 'nmap', binary: 'nmap', category: 'recon', os: ['kali', 'parrot', 'any'] },
  { name: 'metasploit', package: 'metasploit-framework', binary: 'msfconsole', category: 'exploit', os: ['kali', 'parrot'] },
  { name: 'nuclei', package: 'nuclei', binary: 'nuclei', category: 'vuln', os: ['kali', 'parrot', 'any'] },
  { name: 'autopsy', package: 'autopsy', binary: 'autopsy', category: 'forensic', os: ['kali', 'csi'] },
  { name: 'volatility', package: 'volatility3', binary: 'vol', category: 'forensic', os: ['kali', 'parrot', 'csi'] },
  { name: 'wireshark', package: 'wireshark', binary: 'tshark', category: 'forensic', os: ['kali', 'parrot', 'csi'] },
  { name: 'yara', package: 'yara', binary: 'yara', category: 'forensic', os: ['all'] },
  { name: 'sleuthkit', package: 'sleuthkit', binary: 'fls', category: 'forensic', os: ['kali', 'csi'] },
  { name: 'john', package: 'john', binary: 'john', category: 'exploit', os: ['kali', 'parrot'] },
  { name: 'hashcat', package: 'hashcat', binary: 'hashcat', category: 'exploit', os: ['kali', 'parrot'] },
  { name: 'hydra', package: 'hydra', binary: 'hydra', category: 'exploit', os: ['kali', 'parrot'] },
  { name: 'burpsuite', package: 'burpsuite', binary: 'burpsuite', category: 'web', os: ['kali', 'parrot'] },
  { name: 'ffuf', package: 'ffuf', binary: 'ffuf', category: 'web', os: ['kali', 'parrot', 'any'] },
  { name: 'sqlmap', package: 'sqlmap', binary: 'sqlmap', category: 'web', os: ['kali', 'parrot'] },
  { name: 'aircrack-ng', package: 'aircrack-ng', binary: 'aircrack-ng', category: 'wireless', os: ['kali', 'parrot'] },
  { name: 'bettercap', package: 'bettercap', binary: 'bettercap', category: 'wireless', os: ['kali', 'parrot'] },
  { name: 'amass', package: 'amass', binary: 'amass', category: 'recon', os: ['kali', 'parrot', 'any'] },
  { name: 'ghidra', package: 'ghidra', binary: 'ghidra', category: 'forensic', os: ['kali', 'parrot'] },
  { name: 'binwalk', package: 'binwalk', binary: 'binwalk', category: 'forensic', os: ['kali', 'parrot'] },
  { name: 'dc3dd', package: 'dc3dd', binary: 'dc3dd', category: 'forensic', os: ['csi'] },
  { name: 'log2timeline', package: 'plaso', binary: 'log2timeline.py', category: 'forensic', os: ['csi'] },
  { name: 'cyberchef', package: 'cyberchef', binary: 'cyberchef', category: 'forensic', os: ['all'] },
  { name: 'regripper', package: 'regripper', binary: 'rip', category: 'forensic', os: ['kali', 'csi'] },
  { name: 'foremost', package: 'foremost', binary: 'foremost', category: 'forensic', os: ['kali', 'csi'] },
  { name: 'spiderfoot', package: 'spiderfoot', binary: 'spiderfoot', category: 'recon', os: ['kali', 'parrot'] },
  { name: 'theHarvester', package: 'theharvester', binary: 'theHarvester', category: 'recon', os: ['kali', 'parrot'] },
  { name: 'nikto', package: 'nikto', binary: 'nikto', category: 'vuln', os: ['kali', 'parrot'] },
  { name: 'wpscan', package: 'wpscan', binary: 'wpscan', category: 'web', os: ['kali', 'parrot'] },
  { name: 'responder', package: 'responder', binary: 'responder', category: 'exploit', os: ['kali', 'parrot'] },
  { name: 'bloodhound', package: 'bloodhound', binary: 'bloodhound-python', category: 'recon', os: ['kali', 'parrot'] },
  { name: 'crackmapexec', package: 'crackmapexec', binary: 'crackmapexec', category: 'exploit', os: ['kali', 'parrot'] },
  { name: 'impacket', package: 'impacket-scripts', binary: 'impacket-secretsdump', category: 'exploit', os: ['kali', 'parrot'] },
  { name: 'mimikatz', package: 'mimikatz', binary: 'mimikatz', category: 'exploit', os: ['kali', 'parrot'] },
  { name: 'snort', package: 'snort', binary: 'snort', category: 'blue', os: ['kali', 'parrot'] },
  { name: 'scapy', package: 'scapy', binary: 'scapy', category: 'network', os: ['kali', 'parrot'] },
  { name: 'radare2', package: 'radare2', binary: 'r2', category: 'forensic', os: ['kali', 'parrot'] },
  { name: 'bulk-extractor', package: 'bulk-extractor', binary: 'bulk_extractor', category: 'forensic', os: ['kali', 'csi'] },
  { name: 'anonsurf', package: 'anonsurf', binary: 'anonsurf', category: 'privacy', os: ['parrot'] },
  { name: 'mat2', package: 'mat2', binary: 'mat2', category: 'privacy', os: ['parrot', 'any'] },
  { name: 'maltego', package: 'maltego', binary: 'maltego', category: 'recon', os: ['kali', 'parrot'] },
  { name: 'metagoofil', package: 'metagoofil', binary: 'metagoofil', category: 'recon', os: ['kali'] },
  { name: 'sherlock', package: 'sherlock', binary: 'sherlock', category: 'recon', os: ['kali', 'parrot', 'any'] },
  { name: 'cewl', package: 'cewl', binary: 'cewl', category: 'recon', os: ['kali', 'parrot'] },
];

// Detection: which tools are available?
async function detectAvailableTools(): Promise<SecurityTool[]> {
  const available: SecurityTool[] = [];
  for (const tool of SECURITY_TOOLS) {
    try {
      await exec(`which ${tool.binary}`);
      available.push(tool);
    } catch {
      // Tool not installed; offer to install
    }
  }
  return available;
}

// CLI: carina security tools list; shows available and missing tools
// CLI: carina security tools install <name>; apt install the tool
// CLI: carina security tools install --all; install all available tools
```

### 5.3 Kali/Parrot/CSI Detection

```typescript
// Detect which OS Carina is running on
async function detectSecurityOS(): Promise<'kali' | 'parrot' | 'csi' | 'other'> {
  const osRelease = await readFile('/etc/os-release');
  if (osRelease.includes('Kali')) return 'kali';
  if (osRelease.includes('Parrot')) return 'parrot';
  if (osRelease.includes('CSI')) return 'csi';
  return 'other';
}

// Adapt tool recommendations based on OS
async function recommendTools(): Promise<string[]> {
  const os = await detectSecurityOS();
  const available = await detectAvailableTools();
  const recommended = SECURITY_TOOLS.filter(t => t.os.includes(os) || t.os.includes('any'));
  const missing = recommended.filter(t => !available.find(a => a.name === t.name));
  return missing.map(t => t.name);
}
```

---

## 6. CARINA SECURITY AGENT; COMPLETE TOOL INVENTORY

### Category Summary

| Category | Kali | Parrot | CSI | Total Adopted |
|----------|------|--------|-----|---------------|
| **Recon/OSINT** | 8 | 6 | 2 | 10 |
| **Vulnerability Scanning** | 7 | 5 | 1 | 8 |
| **Exploitation** | 8 | 5 | 0 | 8 |
| **Web App Testing** | 7 | 4 | 0 | 7 |
| **Wireless/Network** | 5 | 3 | 0 | 5 |
| **Forensics** | 6 | 4 | 10 | 12 |
| **Sniffing/Traffic** | 4 | 3 | 3 | 5 |
| **Privacy/OPSEC** | 0 | 3 | 0 | 2 |
| **Reverse Engineering** | 3 | 3 | 0 | 4 |
| **Blue Team/Defense** | 2 | 2 | 3 | 4 |
| **Reporting** | 1 | 1 | 3 | 3 |
| **TOTAL** | **51** | **39** | **22** | **68** |

---

## 7. IMPLEMENTATION PLAN

### Phase 1; Recon & Discovery (Weeks 1-2)
```
Done:  nmap wrapper tool
Done:  amass wrapper tool
Done:  theHarvester wrapper tool
Done:  spiderfoot orchestration
Done:  subfinder + sublist3r integration
Done:  Automated recon workflows
Done:  OS detection (Kali/Parrot/CSI)
Done:  Tool availability detection
```

### Phase 2; Vulnerability & Web (Weeks 3-4)
```
Done:  nuclei template-based scanning
Done:  nikto web server assessment
Done:  sqlmap SQL injection testing
Done:  ffuf fuzzing integration
Done:  burpsuite API integration
Done:  wpscan WordPress testing
Done:  Automated vulnerability report generation
```

### Phase 3; Exploitation & Post-Exploit (Weeks 5-6)
```
Done:  metasploit framework orchestration
Done:  impacket Windows exploitation
Done:  hydra brute force automation
Done:  john + hashcat cracking pipeline
Done:  crackmapexec network exploitation
Done:  bloodhound AD mapping
Done:  Post-exploitation data collection
```

### Phase 4; Forensics Pipeline (Weeks 7-9)
```
Done:  dc3dd forensically sound imaging
Done:  volatility3 memory analysis
Done:  autopsy case management
Done:  sleuthkit file system analysis
Done:  log2timeline super timeline
Done:  regripper registry analysis
Done:  bulk-extractor data extraction
Done:  yara signature scanning
Done:  binwalk firmware analysis
Done:  foremost file carving
Done:  cyberchef data transformation
Done:  Chain of custody tracking
```

### Phase 5; Wireless & Network (Weeks 10-11)
```
Done:  aircrack-ng WiFi auditing
Done:  bettercap MITM framework
Done:  wireshark/tshark traffic analysis
Done:  tcpdump packet capture
Done:  kismet wireless monitoring
Done:  scapy packet manipulation
```

### Phase 6; Reporting & Integration (Weeks 12-13)
```
Done:  Automated pentest report generation (PDF/HTML)
Done:  STIX threat intelligence export
Done:  Bug bounty report templates (HackerOne/Bugcrowd)
Done:  Executive summary generation
Done:  Evidence collection with screenshots
Done:  Timeline visualization
Done:  Integration with existing Carina Scout
Done:  Integration with existing Carina Forensics pipeline
```

---

## 8. GAPS & ADVANCEMENTS

### Critical Gaps to Close

| # | Gap | Solution |
|---|-----|----------|
| 1 | No autonomous exploit validation | Metasploit orchestration; agent selects and runs modules |
| 2 | No forensic imaging pipeline | dc3dd + guymager wrappers with chain of custody |
| 3 | No memory forensics | Volatility3; automated process/network/registry analysis |
| 4 | No threat intelligence export | STIX 2.1 generation from findings |
| 5 | No timeline reconstruction for incidents | log2timeline; super timeline from all evidence sources |
| 6 | No bug bounty workflow automation | HackerOne/Bugcrowd report templates, automated PoC generation |
| 7 | No blue team continuous monitoring | Snort/Suricata rule management, automated alert triage |
| 8 | No wireless security testing | aircrack-ng + bettercap for WiFi assessments |
| 9 | No binary reverse engineering | Ghidra/radare2 headless analysis automation |
| 10 | No dark web / OSINT deep dive | spiderfoot + maltego integration for threat actor tracking |

---

## REFERENCE

```
Kali Linux: https://www.kali.org/tools/ (102 tools cataloged)
Parrot OS: https://parrotsec.org/docs/tools/
CSI Linux: https://csilinux.com/
```
