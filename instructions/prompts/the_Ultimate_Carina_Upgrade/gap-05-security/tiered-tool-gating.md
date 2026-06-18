# Tiered Tool Gating; Implementation Spec

**Gap:** 05; Security / Scout Product  
**Type:** Implementation prompt  
**Agent (primary):** Claude Code  
**Agent (fallback):** Cursor  
**Estimated effort:** 4 days

---

## Context

The 72 cyber and forensic tools are Carina's key differentiator. Giving all 72 to free self-hosted users undermines the paid tiers. This spec implements a tiered gating system where each tool has a `requiredTier` and the tool executor enforces it at invocation time. Blocked tools return a structured error with upgrade information. Free-tier tool outputs include an upgrade banner showing what's available at each paid tier.

---

## Module 1: Tier Definitions & Tool Assignments

### 1.1 Tier Definitions

**File:** `core.carinaai.uk/src/tools/tiers.ts`

```typescript
// core.carinaai.uk/src/tools/tiers.ts

export enum WorkspaceTier {
  SELF_HOSTED = 'self-hosted',   // Carina on own infra, free tier
  CLOUD = 'cloud',                // Carina on our infra, paid tier
  MONITOR = 'monitor',            // Scout Monitor; security monitoring
  GOVERN = 'govern',              // Scout Govern; compliance + forensics
  ENTERPRISE = 'enterprise',      // Dedicated infra, SSO, SLA
}

export const TIER_ORDER: Record<WorkspaceTier, number> = {
  [WorkspaceTier.SELF_HOSTED]: 0,
  [WorkspaceTier.CLOUD]: 1,
  [WorkspaceTier.MONITOR]: 2,
  [WorkspaceTier.GOVERN]: 3,
  [WorkspaceTier.ENTERPRISE]: 4,
};

export interface TierInfo {
  id: WorkspaceTier;
  name: string;
  toolCount: number;
  description: string;
}

/**
 * TIER METADATA; NO PRICES HARDCODED.
 * Prices live in Scout's billing system and the marketing website.
 * Carina fetches tier from Scout API. Carina never stores or displays prices.
 * The upgrade URL points to the pricing page where Scout controls the displayed price.
 */
export const TIER_INFO: Record<WorkspaceTier, TierInfo> = {
  [WorkspaceTier.SELF_HOSTED]: {
    id: WorkspaceTier.SELF_HOSTED,
    name: 'Self-Hosted Carina',
    toolCount: 8,
    description: 'Basic reconnaissance tools. Discover targets, map surfaces.',
  },
  [WorkspaceTier.CLOUD]: {
    id: WorkspaceTier.CLOUD,
    name: 'Cloud Carina',
    toolCount: 20,
    description: 'Vulnerability scanning + OSINT. Find CVEs, discover exposures.',
  },
  [WorkspaceTier.MONITOR]: {
    id: WorkspaceTier.MONITOR,
    name: 'Scout Monitor',
    toolCount: 55,
    description: 'Full exploitation + wireless + traffic analysis. Red team operations.',
  },
  [WorkspaceTier.GOVERN]: {
    id: WorkspaceTier.GOVERN,
    name: 'Scout Govern',
    toolCount: 72,
    description: 'Complete forensics pipeline + compliance. Enterprise security platform.',
  },
  [WorkspaceTier.ENTERPRISE]: {
    id: WorkspaceTier.ENTERPRISE,
    name: 'Enterprise',
    toolCount: 72,
    description: 'SSO, data residency, SLA, dedicated infrastructure.',
  },
};

/** Upgrade URL; single source of truth. Scout's pricing page controls the displayed price. */
export const UPGRADE_URL = process.env.SCOUT_UPGRADE_URL || 'https://labyrinthscout.com/pricing';
export const ENTERPRISE_URL = process.env.SCOUT_ENTERPRISE_URL || 'https://labyrinthscout.com/enterprise';

export function getUpgradePath(currentTier: WorkspaceTier): TierInfo[] {
  const currentLevel = TIER_ORDER[currentTier];
  return Object.values(TIER_INFO)
    .filter(t => TIER_ORDER[t.id] > currentLevel)
    .sort((a, b) => TIER_ORDER[a.id] - TIER_ORDER[b.id]);
}

export function getToolCountAtTier(tier: WorkspaceTier): number {
  // Count all tools with requiredTier <= this tier
  // Imported from tool registry at runtime to avoid circular deps
  return TIER_INFO[tier].toolCount;
}
```

### 1.2 Full Tool Tier Assignments

**File:** `core.carinaai.uk/src/tools/cyber-tools-registry.ts`

Every tool gets a `requiredTier` field. The assignments follow the conversion ladder.

```typescript
// core.carinaai.uk/src/tools/cyber-tools-registry.ts

import { WorkspaceTier } from './tiers.js';
import { ToolDefinition } from './types.js';

export const CYBER_TOOLS: ToolDefinition[] = [

  // ═══════════════════════════════════════════════════════════
  // TIER: SELF-HOSTED; 8 tools; Reconnaissance only
  // ═══════════════════════════════════════════════════════════

  {
    name: 'nmap',
    category: 'reconnaissance',
    requiredTier: WorkspaceTier.SELF_HOSTED,
    description: 'Network port scanner. Basic scan: nmap -sV -sC <target>. NSE scripts require Cloud tier.',
    triggers: ['scan ports', 'port scan', 'nmap'],
    upgradeNote: 'Advanced NSE scripts, vulnerability scanning, and OS fingerprinting available on Cloud Carina.',
  },
  {
    name: 'amass',
    category: 'reconnaissance',
    requiredTier: WorkspaceTier.SELF_HOSTED,
    description: 'Subdomain enumeration. Passive and active recon.',
    triggers: ['find subdomains', 'subdomain enumeration', 'amass'],
    upgradeNote: 'Vulnerability scanning on discovered subdomains requires Cloud Carina.',
  },
  {
    name: 'theHarvester',
    category: 'reconnaissance',
    requiredTier: WorkspaceTier.SELF_HOSTED,
    description: 'Email, subdomain, and name harvesting from public sources.',
    triggers: ['find emails', 'harvest emails', 'theHarvester'],
    upgradeNote: null, // This tool is terminal; no natural next step to upsell
  },
  {
    name: 'shodan',
    category: 'reconnaissance',
    requiredTier: WorkspaceTier.SELF_HOSTED,
    description: 'Search engine for internet-connected devices. Passive recon.',
    triggers: ['shodan search', 'search shodan', 'internet devices'],
    upgradeNote: 'Automated vulnerability scanning against Shodan results requires Cloud Carina.',
  },
  {
    name: 'censys',
    category: 'reconnaissance',
    requiredTier: WorkspaceTier.SELF_HOSTED,
    description: 'Internet asset discovery platform. Passive recon.',
    triggers: ['censys search', 'search censys'],
    upgradeNote: null,
  },
  {
    name: 'masscan',
    category: 'reconnaissance',
    requiredTier: WorkspaceTier.SELF_HOSTED,
    description: 'Fast port scanner. Scan entire internet in minutes.',
    triggers: ['mass scan', 'masscan', 'fast port scan'],
    upgradeNote: 'Vulnerability assessment on discovered services requires Cloud Carina.',
  },
  {
    name: 'curl',
    category: 'utility',
    requiredTier: WorkspaceTier.SELF_HOSTED,
    description: 'HTTP client. Fetch URLs, test endpoints.',
    triggers: ['curl', 'fetch url', 'http request'],
    upgradeNote: null,
  },
  {
    name: 'netcat',
    category: 'utility',
    requiredTier: WorkspaceTier.SELF_HOSTED,
    description: 'TCP/UDP connection tool. Port testing, banner grabbing.',
    triggers: ['netcat', 'nc', 'connect to port'],
    upgradeNote: null,
  },

  // ═══════════════════════════════════════════════════════════
  // TIER: CLOUD; 12 additional tools; Vulnerability scanning + OSINT
  // ═══════════════════════════════════════════════════════════
  // Total at this tier: 20 tools (8 free + 12)

  {
    name: 'nuclei',
    category: 'vulnerability-scanning',
    requiredTier: WorkspaceTier.CLOUD,
    description: 'Fast vulnerability scanner. 2,000+ CVE templates. Template-based scanning.',
    triggers: ['scan vulnerabilities', 'nuclei scan', 'cve scan', 'vulnerability scan'],
    upgradeNote: 'Exploitation of discovered vulnerabilities requires Scout Monitor.',
  },
  {
    name: 'openvas',
    category: 'vulnerability-scanning',
    requiredTier: WorkspaceTier.CLOUD,
    description: 'Comprehensive vulnerability scanner. 50,000+ network vulnerability tests.',
    triggers: ['openvas', 'greenbone', 'full vulnerability scan'],
    upgradeNote: null,
  },
  {
    name: 'nikto',
    category: 'vulnerability-scanning',
    requiredTier: WorkspaceTier.CLOUD,
    description: 'Web server scanner. 6,700+ dangerous files and misconfigurations.',
    triggers: ['nikto', 'web server scan'],
    upgradeNote: null,
  },
  {
    name: 'wapiti',
    category: 'vulnerability-scanning',
    requiredTier: WorkspaceTier.CLOUD,
    description: 'Web application vulnerability scanner. XSS, SQLi, file inclusion.',
    triggers: ['wapiti', 'web app scan'],
    upgradeNote: null,
  },
  {
    name: 'sqlmap',
    category: 'vulnerability-scanning',
    requiredTier: WorkspaceTier.CLOUD,
    description: 'Automatic SQL injection detection and exploitation tool.',
    triggers: ['sql injection', 'sqli', 'sqlmap', 'test sql injection'],
    upgradeNote: 'Advanced exploitation of SQLi findings requires Scout Monitor.',
  },
  {
    name: 'maltego',
    category: 'osint',
    requiredTier: WorkspaceTier.CLOUD,
    description: 'OSINT and link analysis. Entity relationship graphing.',
    triggers: ['maltego', 'osint graph', 'link analysis'],
    upgradeNote: null,
  },
  {
    name: 'holehe',
    category: 'osint',
    requiredTier: WorkspaceTier.CLOUD,
    description: 'Check if email is registered on various websites.',
    triggers: ['holehe', 'email check', 'check email accounts'],
    upgradeNote: null,
  },
  {
    name: 'sherlock',
    category: 'osint',
    requiredTier: WorkspaceTier.CLOUD,
    description: 'Find usernames across social networks.',
    triggers: ['sherlock', 'find username', 'username search'],
    upgradeNote: null,
  },
  {
    name: 'phoneinfoga',
    category: 'osint',
    requiredTier: WorkspaceTier.CLOUD,
    description: 'Phone number information gathering.',
    triggers: ['phoneinfoga', 'phone lookup', 'phone number scan'],
    upgradeNote: null,
  },
  {
    name: 'emailrep',
    category: 'osint',
    requiredTier: WorkspaceTier.CLOUD,
    description: 'Email reputation and risk scoring API.',
    triggers: ['emailrep', 'email reputation', 'check email risk'],
    upgradeNote: null,
  },
  {
    name: 'hibp',
    category: 'osint',
    requiredTier: WorkspaceTier.CLOUD,
    description: 'Have I Been Pwned API. Check email/domain for data breaches.',
    triggers: ['have i been pwned', 'hibp', 'data breach check', 'pwned'],
    upgradeNote: null,
  },
  {
    name: 'wayback',
    category: 'osint',
    requiredTier: WorkspaceTier.CLOUD,
    description: 'Wayback Machine. Historical web page snapshots.',
    triggers: ['wayback', 'internet archive', 'historical website'],
    upgradeNote: null,
  },

  // ═══════════════════════════════════════════════════════════
  // TIER: MONITOR; 35 additional tools; Exploitation + Wireless + Traffic + Utility
  // ═══════════════════════════════════════════════════════════
  // Total at this tier: 55 tools (20 + 35)

  // --- EXPLOITATION (12 tools) ---
  {
    name: 'metasploit',
    category: 'exploitation',
    requiredTier: WorkspaceTier.MONITOR,
    description: 'Exploitation framework. 2,000+ exploit modules. Payload generation, post-exploitation.',
    triggers: ['metasploit', 'msfconsole', 'exploit', 'meterpreter'],
    upgradeNote: 'Forensics analysis of exploitation results requires Scout Govern.',
  },
  {
    name: 'impacket',
    category: 'exploitation',
    requiredTier: WorkspaceTier.MONITOR,
    description: 'Python library for working with network protocols. SMB, Kerberos, LDAP exploitation.',
    triggers: ['impacket', 'secretsdump', 'wmiexec', 'smbexec'],
    upgradeNote: null,
  },
  {
    name: 'hydra',
    category: 'exploitation',
    requiredTier: WorkspaceTier.MONITOR,
    description: 'Network login brute-forcer. 50+ protocols. SSH, FTP, HTTP, RDP, SMB.',
    triggers: ['hydra', 'brute force', 'password attack', 'login brute'],
    upgradeNote: null,
  },
  {
    name: 'john',
    category: 'exploitation',
    requiredTier: WorkspaceTier.MONITOR,
    description: 'John the Ripper. Password hash cracker. CPU-based.',
    triggers: ['john', 'john the ripper', 'crack hash', 'crack password'],
    upgradeNote: null,
  },
  {
    name: 'hashcat',
    category: 'exploitation',
    requiredTier: WorkspaceTier.MONITOR,
    description: 'GPU-accelerated password hash cracker. 300+ hash types.',
    triggers: ['hashcat', 'gpu crack', 'crack hash gpu'],
    upgradeNote: null,
  },
  {
    name: 'evil-winrm',
    category: 'exploitation',
    requiredTier: WorkspaceTier.MONITOR,
    description: 'Windows Remote Management shell. Post-exploitation lateral movement.',
    triggers: ['evil-winrm', 'winrm shell', 'windows remote'],
    upgradeNote: null,
  },
  {
    name: 'crackmapexec',
    category: 'exploitation',
    requiredTier: WorkspaceTier.MONITOR,
    description: 'Active Directory exploitation swiss army knife. SMB, WinRM, MSSQL, RDP.',
    triggers: ['crackmapexec', 'cme', 'ad exploitation'],
    upgradeNote: null,
  },
  {
    name: 'responder',
    category: 'exploitation',
    requiredTier: WorkspaceTier.MONITOR,
    description: 'LLMNR, NBT-NS, and MDNS poisoner. Captures NTLM hashes.',
    triggers: ['responder', 'ntlm capture', 'hash capture'],
    upgradeNote: null,
  },
  {
    name: 'mimikatz',
    category: 'exploitation',
    requiredTier: WorkspaceTier.MONITOR,
    description: 'Windows credential dumper. Extract plaintext passwords, hashes, tickets.',
    triggers: ['mimikatz', 'dump credentials', 'dump hashes windows'],
    upgradeNote: null,
  },
  {
    name: 'powersploit',
    category: 'exploitation',
    requiredTier: WorkspaceTier.MONITOR,
    description: 'PowerShell post-exploitation framework.',
    triggers: ['powersploit', 'powershell exploit', 'powershell post-exploit'],
    upgradeNote: null,
  },
  {
    name: 'empire',
    category: 'exploitation',
    requiredTier: WorkspaceTier.MONITOR,
    description: 'Post-exploitation C2 framework. PowerShell and Python agents.',
    triggers: ['empire', 'c2 framework', 'post-exploit agent'],
    upgradeNote: null,
  },
  {
    name: 'covenant',
    category: 'exploitation',
    requiredTier: WorkspaceTier.MONITOR,
    description: '.NET C2 framework. Collaborative red team operations.',
    triggers: ['covenant', 'dotnet c2', 'grunt agent'],
    upgradeNote: null,
  },

  // --- WEB APPLICATION (4 tools) ---
  {
    name: 'burp-suite',
    category: 'web',
    requiredTier: WorkspaceTier.MONITOR,
    description: 'Web application security testing platform. Proxy, scanner, intruder, repeater.',
    triggers: ['burp', 'burp suite', 'web proxy', 'intercept traffic'],
    upgradeNote: null,
  },
  {
    name: 'gobuster',
    category: 'web',
    requiredTier: WorkspaceTier.MONITOR,
    description: 'Directory, file, and DNS busting tool.',
    triggers: ['gobuster', 'directory bust', 'dir brute'],
    upgradeNote: null,
  },
  {
    name: 'ffuf',
    category: 'web',
    requiredTier: WorkspaceTier.MONITOR,
    description: 'Fast web fuzzer. Directory, parameter, vhost fuzzing.',
    triggers: ['ffuf', 'web fuzz', 'fuzz parameters'],
    upgradeNote: null,
  },
  {
    name: 'wfuzz',
    category: 'web',
    requiredTier: WorkspaceTier.MONITOR,
    description: 'Web application brute-forcer. Parameters, directories, authentication.',
    triggers: ['wfuzz', 'web brute force', 'fuzz login'],
    upgradeNote: null,
  },

  // --- WIRELESS (6 tools) ---
  {
    name: 'aircrack-ng',
    category: 'wireless',
    requiredTier: WorkspaceTier.MONITOR,
    description: 'WiFi security auditing suite. WEP/WPA/WPA2 cracking.',
    triggers: ['aircrack', 'wifi crack', 'wpa crack', 'wep crack'],
    upgradeNote: null,
  },
  {
    name: 'kismet',
    category: 'wireless',
    requiredTier: WorkspaceTier.MONITOR,
    description: 'Wireless network detector and sniffer. Passive monitoring.',
    triggers: ['kismet', 'wifi scan', 'wireless detect', 'passive wifi'],
    upgradeNote: null,
  },
  {
    name: 'wifite',
    category: 'wireless',
    requiredTier: WorkspaceTier.MONITOR,
    description: 'Automated wireless attack tool. WPS, WPA, WEP attacks.',
    triggers: ['wifite', 'automated wifi attack', 'wifi audit'],
    upgradeNote: null,
  },
  {
    name: 'bettercap',
    category: 'wireless',
    requiredTier: WorkspaceTier.MONITOR,
    description: 'Swiss army knife for WiFi, BLE, and Ethernet attacks. MITM.',
    triggers: ['bettercap', 'mitm attack', 'network attack', 'arp spoof'],
    upgradeNote: null,
  },
  {
    name: 'reaver',
    category: 'wireless',
    requiredTier: WorkspaceTier.MONITOR,
    description: 'WPS brute-force attack tool. PIN recovery.',
    triggers: ['reaver', 'wps attack', 'wps pin'],
    upgradeNote: null,
  },
  {
    name: 'hcxdumptool',
    category: 'wireless',
    requiredTier: WorkspaceTier.MONITOR,
    description: 'Capture WPA handshakes and PMKIDs for offline cracking.',
    triggers: ['hcxdumptool', 'capture handshake', 'wpa capture', 'pmkid'],
    upgradeNote: null,
  },

  // --- TRAFFIC ANALYSIS (5 tools) ---
  {
    name: 'wireshark',
    category: 'traffic-analysis',
    requiredTier: WorkspaceTier.MONITOR,
    description: 'Network protocol analyzer. Deep packet inspection.',
    triggers: ['wireshark', 'tshark', 'packet capture', 'capture traffic', 'pcap'],
    upgradeNote: null,
  },
  {
    name: 'tcpdump',
    category: 'traffic-analysis',
    requiredTier: WorkspaceTier.MONITOR,
    description: 'Command-line packet analyzer.',
    triggers: ['tcpdump', 'dump packets', 'capture network'],
    upgradeNote: null,
  },
  {
    name: 'zeek',
    category: 'traffic-analysis',
    requiredTier: WorkspaceTier.MONITOR,
    description: 'Network security monitoring. Protocol analysis, connection logging.',
    triggers: ['zeek', 'bro ids', 'network monitor'],
    upgradeNote: null,
  },
  {
    name: 'suricata',
    category: 'traffic-analysis',
    requiredTier: WorkspaceTier.MONITOR,
    description: 'IDS/IPS engine. Real-time intrusion detection.',
    triggers: ['suricata', 'ids', 'intrusion detection', 'network ids'],
    upgradeNote: null,
  },
  {
    name: 'snort',
    category: 'traffic-analysis',
    requiredTier: WorkspaceTier.MONITOR,
    description: 'Network intrusion detection and prevention system.',
    triggers: ['snort', 'snort ids', 'network intrusion'],
    upgradeNote: null,
  },

  // --- UTILITY (8 tools) ---
  {
    name: 'ssh-audit',
    category: 'utility',
    requiredTier: WorkspaceTier.MONITOR,
    description: 'SSH server and client configuration auditor.',
    triggers: ['ssh audit', 'ssh security', 'ssh config check'],
    upgradeNote: null,
  },
  {
    name: 'openssl',
    category: 'utility',
    requiredTier: WorkspaceTier.MONITOR,
    description: 'SSL/TLS toolkit. Certificate analysis, encryption operations.',
    triggers: ['openssl', 'ssl check', 'tls check', 'certificate'],
    upgradeNote: null,
  },
  {
    name: 'gpg',
    category: 'utility',
    requiredTier: WorkspaceTier.MONITOR,
    description: 'Encryption and signing tool. PGP/GPG key management.',
    triggers: ['gpg', 'encrypt', 'decrypt', 'sign file'],
    upgradeNote: null,
  },
  {
    name: 'socat',
    category: 'utility',
    requiredTier: WorkspaceTier.MONITOR,
    description: 'Multipurpose relay. TCP, UDP, SSL, proxy, forwarding.',
    triggers: ['socat', 'port forward', 'relay', 'proxy'],
    upgradeNote: null,
  },

  // ═══════════════════════════════════════════════════════════
  // TIER: GOVERN; 17 additional tools; Forensics + RE + Compliance
  // ═══════════════════════════════════════════════════════════
  // Total at this tier: 72 tools (55 + 17)

  // --- FORENSICS (10 tools) ---
  {
    name: 'volatility',
    category: 'forensics',
    requiredTier: WorkspaceTier.GOVERN,
    description: 'Memory forensics framework. Process analysis, malware detection, registry extraction.',
    triggers: ['volatility', 'memory forensics', 'memory dump', 'ram analysis'],
    upgradeNote: null,
  },
  {
    name: 'autopsy',
    category: 'forensics',
    requiredTier: WorkspaceTier.GOVERN,
    description: 'Digital forensics platform. Disk image analysis, timeline generation.',
    triggers: ['autopsy', 'disk forensics', 'file recovery', 'forensic analysis'],
    upgradeNote: null,
  },
  {
    name: 'bulk-extractor',
    category: 'forensics',
    requiredTier: WorkspaceTier.GOVERN,
    description: 'Extract email addresses, URLs, credit card numbers from disk images.',
    triggers: ['bulk extractor', 'data carving', 'extract evidence'],
    upgradeNote: null,
  },
  {
    name: 'dc3dd',
    category: 'forensics',
    requiredTier: WorkspaceTier.GOVERN,
    description: 'Patched dd for forensic imaging. Hashing on-the-fly.',
    triggers: ['dc3dd', 'forensic image', 'disk image', 'dd forensic'],
    upgradeNote: null,
  },
  {
    name: 'guymager',
    category: 'forensics',
    requiredTier: WorkspaceTier.GOVERN,
    description: 'Forensic imaging tool. Multi-threaded, EWF and AFF support.',
    triggers: ['guymager', 'forensic acquisition', 'ewf image'],
    upgradeNote: null,
  },
  {
    name: 'foremost',
    category: 'forensics',
    requiredTier: WorkspaceTier.GOVERN,
    description: 'File carving tool. Recover files from disk images by header/footer.',
    triggers: ['foremost', 'carve files', 'recover deleted'],
    upgradeNote: null,
  },
  {
    name: 'scalpel',
    category: 'forensics',
    requiredTier: WorkspaceTier.GOVERN,
    description: 'Fast file carver. Filesystem-independent recovery.',
    triggers: ['scalpel', 'file carving fast', 'recover files'],
    upgradeNote: null,
  },
  {
    name: 'binwalk',
    category: 'forensics',
    requiredTier: WorkspaceTier.GOVERN,
    description: 'Firmware analysis tool. Extract embedded files and filesystems.',
    triggers: ['binwalk', 'firmware analysis', 'extract firmware'],
    upgradeNote: null,
  },
  {
    name: 'exiftool',
    category: 'forensics',
    requiredTier: WorkspaceTier.GOVERN,
    description: 'Read and write metadata. EXIF, IPTC, XMP from images, videos, audio.',
    triggers: ['exiftool', 'metadata', 'exif data', 'image metadata'],
    upgradeNote: null,
  },
  {
    name: 'ghidra',
    category: 'reverse-engineering',
    requiredTier: WorkspaceTier.GOVERN,
    description: 'NSA reverse engineering suite. Disassembler, decompiler, scripting.',
    triggers: ['ghidra', 'reverse engineer', 'decompile', 'disassemble'],
    upgradeNote: null,
  },

  // --- REVERSE ENGINEERING (4 tools) ---
  {
    name: 'radare2',
    category: 'reverse-engineering',
    requiredTier: WorkspaceTier.GOVERN,
    description: 'Reverse engineering framework. Disassembly, debugging, binary analysis.',
    triggers: ['radare2', 'r2', 'binary analysis', 'disassemble binary'],
    upgradeNote: null,
  },
  {
    name: 'objdump',
    category: 'reverse-engineering',
    requiredTier: WorkspaceTier.GOVERN,
    description: 'Display information from object files. Disassembly, headers, symbols.',
    triggers: ['objdump', 'object dump', 'binary info'],
    upgradeNote: null,
  },
  {
    name: 'strings',
    category: 'reverse-engineering',
    requiredTier: WorkspaceTier.GOVERN,
    description: 'Extract printable strings from binary files.',
    triggers: ['strings', 'extract strings', 'binary strings'],
    upgradeNote: null,
  },
  {
    name: 'ltrace-strace',
    category: 'reverse-engineering',
    requiredTier: WorkspaceTier.GOVERN,
    description: 'Trace library calls and system calls. Dynamic analysis.',
    triggers: ['ltrace', 'strace', 'trace calls', 'system calls'],
    upgradeNote: null,
  },

  // --- REPORTING & COMPLIANCE (3 tools); Govern only, these ARE compliance ---
  {
    name: 'scout-reporter',
    category: 'reporting',
    requiredTier: WorkspaceTier.GOVERN,
    description: 'Automated security report generator. Executive summaries, technical appendices.',
    triggers: ['generate report', 'scout report', 'security report'],
    upgradeNote: null,
  },
  {
    name: 'compliance-mapper',
    category: 'reporting',
    requiredTier: WorkspaceTier.GOVERN,
    description: 'Map findings to SOC2, ISO 27001, and GDPR control families.',
    triggers: ['map compliance', 'compliance mapping', 'soc2 mapping'],
    upgradeNote: null,
  },
  {
    name: 'evidence-packager',
    category: 'reporting',
    requiredTier: WorkspaceTier.GOVERN,
    description: 'Package evidence for auditors. Cryptographically signed audit packages.',
    triggers: ['package evidence', 'auditor package', 'evidence export'],
    upgradeNote: null,
  },
];
```

---

## Module 2: Tool Executor Gating

### 2.1 Workspace Tier Detection

**File:** `core.carinaai.uk/src/tools/tier-check.ts`

```typescript
// core.carinaai.uk/src/tools/tier-check.ts

import { WorkspaceTier, TIER_ORDER, getUpgradePath, TierInfo } from './tiers.js';
import { ToolDefinition } from './types.js';

interface WorkspaceContext {
  tier: WorkspaceTier;
  scoutConnected: boolean;
  workspaceId: string;
}

/**
 * Determine the current workspace tier.
 * Enterprise > Govern > Monitor > Cloud > Self-Hosted.
 * Scout being connected is a prerequisite for Monitor tier and above.
 */
export function getWorkspaceTier(ctx: WorkspaceContext): WorkspaceTier {
  // Enterprise: set via env or workspace config
  if (process.env.CARINA_TIER === 'enterprise' || ctx.tier === WorkspaceTier.ENTERPRISE) {
    return WorkspaceTier.ENTERPRISE;
  }

  // Govern: Scout connected + Govern subscription
  if (ctx.tier === WorkspaceTier.GOVERN && ctx.scoutConnected) {
    return WorkspaceTier.GOVERN;
  }

  // Monitor: Scout connected + Monitor subscription
  if (ctx.tier === WorkspaceTier.MONITOR && ctx.scoutConnected) {
    return WorkspaceTier.MONITOR;
  }

  // Cloud: Cloud subscription (no Scout required)
  if (ctx.tier === WorkspaceTier.CLOUD) {
    return WorkspaceTier.CLOUD;
  }

  // Default: Self-hosted (free)
  return WorkspaceTier.SELF_HOSTED;
}

/**
 * Check if a tool can be executed in the current workspace.
 * Returns either { allowed: true } or { allowed: false, ...upgradeInfo }.
 */
export function checkToolAccess(
  tool: ToolDefinition,
  currentTier: WorkspaceTier,
): { allowed: true } | { allowed: false; requiredTier: TierInfo; upgradePath: TierInfo[] } {
  const requiredLevel = TIER_ORDER[tool.requiredTier];
  const currentLevel = TIER_ORDER[currentTier];

  if (currentLevel >= requiredLevel) {
    return { allowed: true };
  }

  const requiredTierInfo = TIER_INFO[tool.requiredTier];
  const upgradePath = getUpgradePath(currentTier);

  return {
    allowed: false,
    requiredTier: requiredTierInfo,
    upgradePath,
  };
}

/**
 * Build the user-facing message when a tool is blocked.
 */
export function buildToolBlockedMessage(
  tool: ToolDefinition,
  currentTier: WorkspaceTier,
  requiredTier: TierInfo,
  upgradePath: TierInfo[],
): string {
  const lines: string[] = [];

  lines.push(`\`${tool.name}\` requires **${requiredTier.name}**.`);
  lines.push('');
  lines.push(`${requiredTier.description}`);
  lines.push('');

  if (upgradePath.length > 0) {
    lines.push('**Upgrade path:**');
    for (const tier of upgradePath) {
      const nextTierTools = tier.toolCount;
      const currentTierTools = TIER_INFO[currentTier].toolCount;
      const gained = nextTierTools - currentTierTools;
      lines.push(`- **${tier.name}**: +${gained} tools; ${tier.description}`);
    }
  }

  lines.push('');
  lines.push(`See pricing: ${UPGRADE_URL}`);
  lines.push(`Connect Scout: \`carina scout connect\``);

  return lines.join('\n');
}

/**
 * Build the upgrade banner injected into free/cloud tier tool outputs.
 */
export function buildUpgradeBanner(currentTier: WorkspaceTier): string | null {
  const upgradePath = getUpgradePath(currentTier);
  if (upgradePath.length === 0) return null;

  const nextTier = upgradePath[0];
  const currentCount = TIER_INFO[currentTier].toolCount;
  const available = 72 - currentCount;

  return [
    '',
    '---',
    '',
    ` **${available} more tools available** with ${nextTier.name}`,
    '',
    `See pricing: ${UPGRADE_URL}`,
  ].join('\n');
}
```

### 2.2 Tool Executor Integration

**File:** `core.carinaai.uk/src/agents/tool-executor.ts`; MODIFY

Add the tier check before tool execution:

```typescript
// Inside executeTool() function, before the actual tool execution:

import { getWorkspaceTier, checkToolAccess, buildToolBlockedMessage, buildUpgradeBanner } from '../tools/tier-check.js';
import { WorkspaceTier } from '../tools/tiers.js';
import { CYBER_TOOLS } from '../tools/cyber-tools-registry.js';

async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  workspace: WorkspaceContext,
): Promise<ToolResult> {
  // Find the tool definition
  const toolDef = CYBER_TOOLS.find(t => t.name === toolName);
  
  if (toolDef) {
    // Check tier access
    const currentTier = getWorkspaceTier(workspace);
    const access = checkToolAccess(toolDef, currentTier);
    
    if (!access.allowed) {
      const message = buildToolBlockedMessage(toolDef, currentTier, access.requiredTier, access.upgradePath);
      return {
        success: false,
        error: message,
        errorType: 'tier_restricted',
        requiredTier: access.requiredTier.id,
        currentTier,
        upgradeUrl: access.requiredTier.upgradeUrl,
      };
    }
  }

  // ... proceed with actual tool execution ...

  // After tool execution, inject upgrade banner for free/cloud tiers
  const currentTier = getWorkspaceTier(workspace);
  const banner = buildUpgradeBanner(currentTier);
  
  if (banner) {
    result.output = (result.output || '') + '\n' + banner;
  }

  return result;
}
```

---

## Module 3: CLI Commands

### 3.1 Tool Availability Command

**File:** `core.carinaai.uk/src/cli/commands/tools.ts`

```bash
carina tools list                    # List available tools at current tier
carina tools list --all              # List ALL 72 tools with tier gates shown
carina tools list --tier monitor     # List tools available at Monitor tier
carina tools info <name>             # Show tool details + required tier
carina tools upgrade-path            # Show upgrade path with tool counts
```

```typescript
// CLI implementation
export function registerToolsCommands(registry: CommandRegistry) {
  registry.register('tools', {
    description: 'Security tool management',
    subcommands: {
      list: {
        description: 'List available security tools',
        options: {
          all: { type: 'boolean', description: 'Show all 72 tools including gated' },
          tier: { type: 'string', description: 'Filter by tier' },
          category: { type: 'string', description: 'Filter by category' },
        },
        handler: async (args) => {
          const currentTier = getWorkspaceTier(getCurrentWorkspace());
          const showAll = args.all || args.tier;
          const filterTier = args.tier ? args.tier as WorkspaceTier : currentTier;

          let tools = CYBER_TOOLS;
          
          if (!showAll) {
            // Only show tools available at current tier
            tools = tools.filter(t => TIER_ORDER[t.requiredTier] <= TIER_ORDER[currentTier]);
          }

          if (args.category) {
            tools = tools.filter(t => t.category === args.category);
          }

          // Output: name | category | required tier | status ( available /  gated)
          for (const tool of tools) {
            const availableAtCurrent = TIER_ORDER[tool.requiredTier] <= TIER_ORDER[currentTier];
            const icon = availableAtCurrent ? '' : '';
            const tierName = TIER_INFO[tool.requiredTier].name;
            console.log(`${icon} ${tool.name.padEnd(20)} ${tool.category.padEnd(22)} ${tierName}`);
          }
        },
      },
      'upgrade-path': {
        description: 'Show tool upgrade path',
        handler: async () => {
          const currentTier = getWorkspaceTier(getCurrentWorkspace());
          const currentCount = getToolCountAtTier(currentTier);
          const upgradePath = getUpgradePath(currentTier);

          console.log(`Current tier: ${TIER_INFO[currentTier].name} (${currentCount} tools available)`);
          console.log('');
          console.log('Upgrade path:');
          for (const tier of upgradePath) {
            const gained = tier.toolCount - currentCount;
            console.log(`  ${tier.name}: +${gained} tools; ${tier.toolCount} total`);
          }
          console.log('');
          console.log(`All 72 tools available at: Scout Govern`);
        },
      },
    },
  });
}
```

---

## Module 4: Workspace Tier Resolution

### 4.1 Tier Resolution from Workspace Config

**File:** `core.carinaai.uk/src/workspace/tier-resolver.ts`

```typescript
// core.carinaai.uk/src/workspace/tier-resolver.ts

import { WorkspaceTier } from '../tools/tiers.js';

interface WorkspaceConfig {
  tier?: string; // Explicit tier override
  scoutConnected?: boolean;
  scoutSubscriptionTier?: string; // 'monitor' | 'govern' | null
  cloudSubscribed?: boolean;
}

export function resolveWorkspaceTier(config: WorkspaceConfig): WorkspaceTier {
  // 1. Explicit tier override (env var or workspace config)
  if (config.tier) {
    const explicit = config.tier as WorkspaceTier;
    if (Object.values(WorkspaceTier).includes(explicit)) {
      return explicit;
    }
  }

  // 2. Scout Govern: Scout connected + Govern subscription
  if (config.scoutConnected && config.scoutSubscriptionTier === 'govern') {
    return WorkspaceTier.GOVERN;
  }

  // 3. Scout Monitor: Scout connected + Monitor subscription
  if (config.scoutConnected && config.scoutSubscriptionTier === 'monitor') {
    return WorkspaceTier.MONITOR;
  }

  // 4. Cloud Carina: Cloud subscription active
  if (config.cloudSubscribed) {
    return WorkspaceTier.CLOUD;
  }

  // 5. Default: Self-hosted (free)
  return WorkspaceTier.SELF_HOSTED;
}
```

---

## Files Summary

```
# Tier definitions + tool assignments
core.carinaai.uk/src/tools/tiers.ts                    CREATE; tier enum, TIER_INFO, getUpgradePath
core.carinaai.uk/src/tools/cyber-tools-registry.ts     CREATE; all 72 tools with requiredTier
core.carinaai.uk/src/tools/tier-check.ts               CREATE; getWorkspaceTier, checkToolAccess, buildToolBlockedMessage, buildUpgradeBanner

# Tool executor integration
core.carinaai.uk/src/agents/tool-executor.ts           MODIFY; add tier check before execution + banner injection

# Workspace tier resolution
core.carinaai.uk/src/workspace/tier-resolver.ts         CREATE; resolveWorkspaceTier from config

# CLI commands
core.carinaai.uk/src/cli/commands/tools.ts              CREATE; tools list, tools upgrade-path, tools info
core.carinaai.uk/src/cli/registry.ts                    MODIFY; register tools command group
```

---

## Done-When Criteria

- [ ] All 72 tools have a `requiredTier` field in the registry
- [ ] 8 tools at Self-Hosted, 12 at Cloud, 35 at Monitor, 17 at Govern
- [ ] `getWorkspaceTier()` correctly resolves tier from workspace config + Scout connection
- [ ] `checkToolAccess()` returns `{ allowed: false }` when tier is too low
- [ ] Blocked tool response includes: tool name, required tier name, upgrade path, upgrade URL
- [ ] Free-tier tool outputs include an upgrade banner showing next tier + tool count
- [ ] Banner does NOT appear for Govern/Enterprise tiers (no more tools to unlock)
- [ ] `carina tools list` shows only tools available at current tier
- [ ] `carina tools list --all` shows all 72 tools with  for gated tools
- [ ] `carina tools upgrade-path` shows the upgrade ladder with tool counts
- [ ] Self-hosted user calling `carina metasploit` gets a readable blocked message with upgrade path
- [ ] Monitor user calling `carina volatility` gets a blocked message pointing to Govern
- [ ] Govern user has access to all 72 tools with no blocked calls
- [ ] TypeScript compiles with zero errors
- [ ] All existing tool execution tests still pass (mock tier to Govern for tests)
