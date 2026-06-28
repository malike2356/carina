import { registry } from './registry.js';
import { TOOLSET_MAP } from './toolset.js';
import { lookupToolRisk } from './tool-risk-registry.js';
import { getCompactToolDescription } from './tool-descriptions.js';

export type ToolSurface =
  | 'agent'
  | 'cli'
  | 'web'
  | 'mcp'
  | 'cron'
  | 'subagent'
  | 'playwright'
  | 'ops'
  | 'pack'
  | 'platform';

export type ToolCatalogEntry = {
  name: string;
  category: string;
  purpose: string;
  surfaces: ToolSurface[];
  toolset?: string;
  optional?: boolean;
  registered: boolean;
  riskClass?: string;
};

const TOOL_META: Record<string, Omit<ToolCatalogEntry, 'name' | 'registered' | 'riskClass'>> = {
  'web-search': {
    category: 'web',
    purpose: 'Search the public web for current information',
    surfaces: ['agent', 'cli', 'web', 'mcp', 'cron', 'subagent'],
    toolset: 'web',
  },
  'http-request': {
    category: 'web',
    purpose: 'Send outbound HTTP requests to APIs and webhooks',
    surfaces: ['agent', 'cli', 'web', 'mcp', 'cron', 'subagent'],
    toolset: 'web',
  },
  'file-read': {
    category: 'file',
    purpose: 'Read local text files with line numbers and pagination',
    surfaces: ['agent', 'cli', 'web', 'mcp', 'cron', 'subagent'],
    toolset: 'file',
  },
  'file-write': {
    category: 'file',
    purpose: 'Create or overwrite local files',
    surfaces: ['agent', 'cli', 'web', 'mcp', 'cron', 'subagent'],
    toolset: 'file',
  },
  patch: {
    category: 'file',
    purpose: 'Apply fuzzy find-and-replace edits to files',
    surfaces: ['agent', 'cli', 'web', 'mcp', 'cron', 'subagent'],
    toolset: 'file',
  },
  'search-files': {
    category: 'file',
    purpose: 'Ripgrep-backed content and filename search',
    surfaces: ['agent', 'cli', 'web', 'mcp', 'cron', 'subagent'],
    toolset: 'file',
  },
  'shell-exec': {
    category: 'terminal',
    purpose: 'Execute shell commands (foreground, background, optional PTY)',
    surfaces: ['agent', 'cli', 'web', 'cron', 'subagent'],
    toolset: 'terminal',
  },
  process: {
    category: 'terminal',
    purpose: 'Manage background shell processes (poll, log, kill, stdin)',
    surfaces: ['agent', 'cli', 'web', 'cron', 'subagent'],
    toolset: 'terminal',
  },
  nmap: {
    category: 'security',
    purpose: 'Network port scanner for reconnaissance',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'security',
  },
  amass: {
    category: 'security',
    purpose: 'Subdomain enumeration and attack surface mapping',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'security',
  },
  theHarvester: {
    category: 'security',
    purpose: 'OSINT email and subdomain harvesting',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'security',
  },
  'recon-ng': {
    category: 'security',
    purpose: 'Modular OSINT framework with workspace isolation',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'security',
  },
  spiderfoot: {
    category: 'security',
    purpose: 'Automated multi-source OSINT scanning',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'security',
  },
  sherlock: {
    category: 'security',
    purpose: 'Username presence search across social sites',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'security',
  },
  maltego: {
    category: 'security',
    purpose: 'Graph-based OSINT entity link analysis',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'security',
  },
  dmitry: {
    category: 'security',
    purpose: 'Combined WHOIS, subdomain, email, and port recon',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'security',
  },
  metagoofil: {
    category: 'security',
    purpose: 'Public document metadata extraction',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'security',
  },
  cewl: {
    category: 'security',
    purpose: 'Website wordlist generation for targeted attacks',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'security',
  },
  shodan: {
    category: 'security',
    purpose: 'Internet-connected device search via Shodan',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'security',
  },
  censys: {
    category: 'security',
    purpose: 'Internet asset discovery via Censys',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'security',
  },
  masscan: {
    category: 'security',
    purpose: 'High-speed port scanner',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'security',
  },
  curl: {
    category: 'security',
    purpose: 'HTTP client for endpoint probing',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'security',
  },
  netcat: {
    category: 'security',
    purpose: 'TCP port connectivity and banner checks',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'security',
  },
  nuclei: {
    category: 'security',
    purpose: 'Template-based vulnerability scanner',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'security',
  },
  nikto: {
    category: 'security',
    purpose: 'Web server misconfiguration and file exposure scanner',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'security',
  },
  sqlmap: {
    category: 'security',
    purpose: 'SQL injection detection and exploitation',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'security',
  },
  wpscan: {
    category: 'security',
    purpose: 'WordPress vulnerability and enumeration scanner',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'security',
  },
  whatweb: {
    category: 'security',
    purpose: 'Web technology stack fingerprinting',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'security',
  },
  yersinia: {
    category: 'security',
    purpose: 'Layer 2 protocol security testing',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'security',
  },
  legion: {
    category: 'security',
    purpose: 'Automated network penetration assessment workflow',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'security',
  },
  metasploit: {
    category: 'security',
    purpose: 'Exploit module execution and suggestion via Metasploit',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'security',
  },
  impacket: {
    category: 'security',
    purpose: 'Windows protocol exploitation and credential dumping',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'security',
  },
  hydra: {
    category: 'security',
    purpose: 'Multi-protocol network login brute forcing',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'security',
  },
  john: {
    category: 'security',
    purpose: 'CPU-based offline password hash cracking',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'security',
  },
  hashcat: {
    category: 'security',
    purpose: 'GPU-accelerated offline password hash cracking',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'security',
  },
  'evil-winrm': {
    category: 'security',
    purpose: 'Remote WinRM PowerShell shell access',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'security',
  },
  crackmapexec: {
    category: 'security',
    purpose: 'Subnet-wide credential validation and lateral movement',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'security',
  },
  mimikatz: {
    category: 'security',
    purpose: 'Credential extraction from meterpreter sessions',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'security',
  },
  burpsuite: {
    category: 'security',
    purpose: 'Burp Suite Pro automated web scanning and proxy',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'security',
  },
  ffuf: {
    category: 'security',
    purpose: 'Fast HTTP fuzzing for paths, vhosts, and parameters',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'security',
  },
  dirsearch: {
    category: 'security',
    purpose: 'Extension-aware web path discovery',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'security',
  },
  feroxbuster: {
    category: 'security',
    purpose: 'Recursive web content discovery',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'security',
  },
  gobuster: {
    category: 'security',
    purpose: 'Directory, DNS, vhost, and S3 brute forcing',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'security',
  },
  arjun: {
    category: 'security',
    purpose: 'Hidden HTTP parameter enumeration',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'security',
  },
  sstimap: {
    category: 'security',
    purpose: 'Server-side template injection detection',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'security',
  },
  'aircrack-ng': {
    category: 'security',
    purpose: 'WiFi capture, deauth, and WPA/WEP cracking',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'security',
  },
  bettercap: {
    category: 'security',
    purpose: 'MITM framework with ARP/DNS spoofing and proxy modules',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'security',
  },
  kismet: {
    category: 'security',
    purpose: 'Passive wireless network and device discovery',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'security',
  },
  wifite: {
    category: 'security',
    purpose: 'Automated WiFi WPS and WPA attack orchestration',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'security',
  },
  ettercap: {
    category: 'security',
    purpose: 'Classic MITM ARP poisoning and credential sniffing',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'security',
  },
  autopsy: {
    category: 'security',
    purpose: 'Digital forensics case ingest and reporting',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'security',
  },
  volatility3: {
    category: 'security',
    purpose: 'Memory dump analysis with Volatility3 plugins',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'security',
  },
  dc3dd: {
    category: 'security',
    purpose: 'Forensically sound block device imaging',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'security',
  },
  sleuthkit: {
    category: 'security',
    purpose: 'Filesystem partition and inode forensic analysis',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'security',
  },
  binwalk: {
    category: 'security',
    purpose: 'Firmware signature scan and extraction',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'security',
  },
  ghidra: {
    category: 'security',
    purpose: 'Headless binary reverse engineering',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'security',
  },
  'bulk-extractor': {
    category: 'security',
    purpose: 'High-speed bulk artifact extraction from evidence',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'security',
  },
  yara: {
    category: 'security',
    purpose: 'YARA rule matching for malware triage',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'security',
  },
  guymager: {
    category: 'security',
    purpose: 'E01/AFF/DD forensic disk imaging',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'security',
  },
  rekall: {
    category: 'security',
    purpose: 'Alternative memory forensics plugin runner',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'security',
  },
  foremost: {
    category: 'security',
    purpose: 'Header/footer file carving from images',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'security',
  },
  plasmo: {
    category: 'security',
    purpose: 'Plaso super-timeline generation',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'security',
  },
  xplico: {
    category: 'security',
    purpose: 'PCAP application-layer protocol decoding',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'security',
  },
  regripper: {
    category: 'security',
    purpose: 'Windows registry hive artifact extraction',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'security',
  },
  hashdeep: {
    category: 'security',
    purpose: 'Evidence hash set audit and verification',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'security',
  },
  ollydbg: {
    category: 'security',
    purpose: 'Wine-hosted OllyDbg malware debugging',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'security',
  },
  tshark: {
    category: 'security',
    purpose: 'Wireshark CLI PCAP and protocol analysis',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'security',
  },
  tcpdump: {
    category: 'security',
    purpose: 'BPF-filtered live packet capture',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'security',
  },
  dsniff: {
    category: 'security',
    purpose: 'Cleartext protocol credential sniffing',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'security',
  },
  responder: {
    category: 'security',
    purpose: 'LLMNR/NBT-NS poisoning and hash capture',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'security',
  },
  scapy: {
    category: 'security',
    purpose: 'Python scapy packet crafting scripts',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'security',
  },
  anonsurf: {
    category: 'security',
    purpose: 'System-wide anonymous routing through Tor',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'security',
  },
  tor: {
    category: 'security',
    purpose: 'Torify proxy command execution and config checks',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'security',
  },
  mat2: {
    category: 'security',
    purpose: 'Metadata and EXIF stripping for shared files',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'security',
  },
  bleachbit: {
    category: 'security',
    purpose: 'Secure local artifact and cache cleaning',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'security',
  },
  gparted: {
    category: 'security',
    purpose: 'Forensic disk partitioning via parted',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'security',
  },
  radare2: {
    category: 'security',
    purpose: 'Radare2 rapid binary triage and scripting',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'security',
  },
  cutter: {
    category: 'security',
    purpose: 'Cutter headless RE exports and scripts',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'security',
  },
  vscodium: {
    category: 'security',
    purpose: 'VSCodium editor launch for RE workflows',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'security',
  },
  snort: {
    category: 'security',
    purpose: 'Snort IDS/IPS monitoring and alert parsing',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'security',
  },
  bloodhound: {
    category: 'security',
    purpose: 'BloodHound AD attack path data collection',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'security',
  },
  log2timeline: {
    category: 'security',
    purpose: 'Plaso log2timeline super-timeline creation',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'security',
  },
  timesketch: {
    category: 'security',
    purpose: 'Timesketch collaborative timeline search',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'security',
  },
  stix: {
    category: 'security',
    purpose: 'STIX 2.1 threat intelligence bundle export',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'security',
  },
  cyberchef: {
    category: 'security',
    purpose: 'CyberChef programmatic recipe transforms',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'security',
  },
  'code-exec': {
    category: 'terminal',
    purpose: 'Run sandboxed scripts with bridged tool access',
    surfaces: ['agent', 'cli', 'web', 'cron', 'subagent'],
    toolset: 'terminal',
  },
  memory: {
    category: 'memory',
    purpose: 'Persist durable facts across sessions (user profile and agent notes)',
    surfaces: ['agent', 'cli', 'web', 'mcp', 'cron'],
    toolset: 'search',
  },
  'session-search': {
    category: 'memory',
    purpose: 'Full-text search across past conversation transcripts',
    surfaces: ['agent', 'cli', 'web', 'mcp', 'cron'],
    toolset: 'search',
  },
  todo: {
    category: 'workspace',
    purpose: 'In-session multi-step task tracking synced to notes surface',
    surfaces: ['agent', 'cli', 'web', 'cron', 'subagent'],
    toolset: 'orchestration',
  },
  clarify: {
    category: 'interaction',
    purpose: 'Ask the user structured or open-ended questions mid-turn',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'orchestration',
  },
  'notes-manage': {
    category: 'workspace',
    purpose: 'CRUD workspace notes, tasks, and reminders (/notes)',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'workspace',
  },
  'documents-manage': {
    category: 'workspace',
    purpose: 'CRUD workspace documents (/documents)',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'workspace',
  },
  'images-gallery': {
    category: 'workspace',
    purpose: 'List, inspect, and delete persisted gallery images (/images)',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'workspace',
  },
  'blog-create': {
    category: 'content',
    purpose: 'Create incident blog drafts',
    surfaces: ['agent', 'cli', 'web', 'mcp', 'cron', 'ops'],
    toolset: 'content',
  },
  'blog-list': {
    category: 'content',
    purpose: 'List incident blog entries',
    surfaces: ['agent', 'cli', 'web', 'mcp', 'cron', 'ops'],
    toolset: 'content',
  },
  'blog-show': {
    category: 'content',
    purpose: 'Show one incident blog entry',
    surfaces: ['agent', 'cli', 'web', 'mcp', 'cron', 'ops'],
    toolset: 'content',
  },
  'blog-edit': {
    category: 'content',
    purpose: 'Edit incident blog entries',
    surfaces: ['agent', 'cli', 'web', 'mcp', 'cron', 'ops'],
    toolset: 'content',
  },
  'blog-delete': {
    category: 'content',
    purpose: 'Delete incident blog entries',
    surfaces: ['agent', 'cli', 'web', 'mcp', 'cron', 'ops'],
    toolset: 'content',
  },
  'blog-approve': {
    category: 'content',
    purpose: 'Approve incident blog drafts',
    surfaces: ['agent', 'cli', 'web', 'mcp', 'cron', 'ops'],
    toolset: 'content',
  },
  'blog-publish': {
    category: 'content',
    purpose: 'Publish incident blog entries',
    surfaces: ['agent', 'cli', 'web', 'mcp', 'cron', 'ops'],
    toolset: 'content',
  },
  'blog-reject': {
    category: 'content',
    purpose: 'Reject incident blog drafts',
    surfaces: ['agent', 'cli', 'web', 'mcp', 'cron', 'ops'],
    toolset: 'content',
  },
  'blog-review': {
    category: 'content',
    purpose: 'Review incident blog drafts',
    surfaces: ['agent', 'cli', 'web', 'mcp', 'cron', 'ops'],
    toolset: 'content',
  },
  'blog-subscriber-list': {
    category: 'content',
    purpose: 'List incident blog subscribers',
    surfaces: ['agent', 'cli', 'web', 'mcp', 'cron', 'ops'],
    toolset: 'content',
  },
  'blog-subscriber-stats': {
    category: 'content',
    purpose: 'Summarize incident blog subscriber counts',
    surfaces: ['agent', 'cli', 'web', 'mcp', 'cron', 'ops'],
    toolset: 'content',
  },
  'blog-research-run': {
    category: 'content',
    purpose: 'Research and draft new incident blog entries',
    surfaces: ['agent', 'cli', 'web', 'mcp', 'cron', 'ops'],
    toolset: 'content',
  },
  'blog-research-status': {
    category: 'content',
    purpose: 'Show the latest incident research run',
    surfaces: ['agent', 'cli', 'web', 'mcp', 'cron', 'ops'],
    toolset: 'content',
  },
  'blog-research-log': {
    category: 'content',
    purpose: 'Show incident research history',
    surfaces: ['agent', 'cli', 'web', 'mcp', 'cron', 'ops'],
    toolset: 'content',
  },
  'blog-generate-page': {
    category: 'content',
    purpose: 'Regenerate the public incidents page',
    surfaces: ['agent', 'cli', 'web', 'mcp', 'cron', 'ops'],
    toolset: 'content',
  },
  'blog-newsletter-send': {
    category: 'content',
    purpose: 'Send the incident newsletter',
    surfaces: ['agent', 'cli', 'web', 'mcp', 'cron', 'ops'],
    toolset: 'content',
  },
  'blog-search-source': {
    category: 'content',
    purpose: 'Search the web for incident source material',
    surfaces: ['agent', 'cli', 'web', 'mcp', 'cron', 'ops'],
    toolset: 'content',
  },
  'delegate-task': {
    category: 'orchestration',
    purpose: 'Spawn parallel subagents with isolated toolsets',
    surfaces: ['agent', 'cli', 'web', 'subagent'],
    toolset: 'orchestration',
  },
  cronjob: {
    category: 'orchestration',
    purpose: 'Schedule recurring or one-shot autonomous jobs',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'orchestration',
  },
  kanban: {
    category: 'orchestration',
    purpose: 'Multi-agent kanban board (legacy combined tool)',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'orchestration',
  },
  'kanban-show': {
    category: 'orchestration',
    purpose: 'Show kanban board summary',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'orchestration',
  },
  'kanban-list': {
    category: 'orchestration',
    purpose: 'List kanban cards',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'orchestration',
  },
  'kanban-create': {
    category: 'orchestration',
    purpose: 'Create kanban cards',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'orchestration',
  },
  'kanban-complete': {
    category: 'orchestration',
    purpose: 'Mark kanban cards complete',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'orchestration',
  },
  'kanban-block': {
    category: 'orchestration',
    purpose: 'Block kanban cards',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'orchestration',
  },
  'kanban-unblock': {
    category: 'orchestration',
    purpose: 'Unblock kanban cards',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'orchestration',
  },
  'kanban-link': {
    category: 'orchestration',
    purpose: 'Link kanban cards',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'orchestration',
  },
  'kanban-comment': {
    category: 'orchestration',
    purpose: 'Comment on kanban cards',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'orchestration',
  },
  'kanban-heartbeat': {
    category: 'orchestration',
    purpose: 'Kanban heartbeat and stale-card checks',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'orchestration',
  },
  'send-message': {
    category: 'messaging',
    purpose: 'Send outbound messages on enabled channel adapters',
    surfaces: ['agent', 'cli', 'web', 'cron', 'subagent'],
    toolset: 'messaging',
  },
  webhook: {
    category: 'messaging',
    purpose: 'Subscribe to and emit outbound webhook events',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'messaging',
  },
  'email-send': {
    category: 'messaging',
    purpose: 'Send outbound email via configured provider',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'messaging',
  },
  'email-smtp-send': {
    category: 'messaging',
    purpose: 'Send email via direct SMTP relay',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'messaging',
  },
  'email-list': {
    category: 'messaging',
    purpose: 'List recent inbound email activity',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'messaging',
  },
  'generate-pdf': {
    category: 'messaging',
    purpose: 'Render HTML or markdown content to a PDF file',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'messaging',
  },
  'skills-list': {
    category: 'skills',
    purpose: 'List installed skills and packs',
    surfaces: ['agent', 'cli', 'web', 'mcp', 'cron', 'subagent'],
    toolset: 'skills',
  },
  'skill-view': {
    category: 'skills',
    purpose: 'Load skill content and linked files',
    surfaces: ['agent', 'cli', 'web', 'mcp', 'cron', 'subagent'],
    toolset: 'skills',
  },
  'skill-manage': {
    category: 'skills',
    purpose: 'Create, update, or delete skills',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'skills',
  },
  'skill-curator': {
    category: 'skills',
    purpose: 'Curate, merge, and deprecate skills',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'skills',
  },
  'agent-sync': {
    category: 'sync',
    purpose: 'Sync state with remote Carina agents',
    surfaces: ['agent', 'cli', 'web', 'mcp'],
    toolset: 'sync',
  },
  contacts: {
    category: 'sync',
    purpose: 'Search personal and business contacts from profiles',
    surfaces: ['agent', 'cli', 'web', 'mcp'],
    toolset: 'sync',
  },
  mcp: {
    category: 'mcp',
    purpose: 'Connect to external MCP servers (stdio and HTTP)',
    surfaces: ['agent', 'cli', 'web', 'mcp'],
    toolset: 'mcp',
  },
  'vision-analyze': {
    category: 'media',
    purpose: 'Analyze images with vision models',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'media',
  },
  'video-analyze': {
    category: 'media',
    purpose: 'Analyze video content',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'media',
  },
  transcription: {
    category: 'media',
    purpose: 'Transcribe audio to text (STT)',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'media',
  },
  'text-to-speech': {
    category: 'media',
    purpose: 'Convert text to speech audio',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'media',
  },
  'image-generation': {
    category: 'media',
    purpose: 'Generate images from prompts and persist to gallery',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'media',
  },
  'video-generation': {
    category: 'media',
    purpose: 'Generate video storyboards or clips when configured',
    surfaces: ['agent', 'cli', 'web', 'cron'],
    toolset: 'media',
  },
  'spotify-search': {
    category: 'media',
    purpose: 'Search Spotify catalog',
    surfaces: ['agent', 'cli', 'web'],
    toolset: 'media',
  },
  'spotify-now-playing': {
    category: 'media',
    purpose: 'Read current Spotify playback',
    surfaces: ['agent', 'cli', 'web'],
    toolset: 'media',
  },
  'spotify-play': {
    category: 'media',
    purpose: 'Control Spotify playback',
    surfaces: ['agent', 'cli', 'web'],
    toolset: 'media',
  },
  'debug-helpers': {
    category: 'debug',
    purpose: 'Expose debug metadata for operator troubleshooting',
    surfaces: ['agent', 'cli', 'ops'],
    toolset: 'debug',
  },
  lsp: {
    category: 'debug',
    purpose: 'Query language servers for definitions and diagnostics',
    surfaces: ['agent', 'cli', 'web'],
    toolset: 'debug',
  },
  'checkpoint-manager': {
    category: 'checkpoint',
    purpose: 'Create and restore workspace checkpoints',
    surfaces: ['agent', 'cli', 'web'],
    toolset: 'checkpoint',
  },
  'mixture-of-agents': {
    category: 'ensemble',
    purpose: 'Run multi-model ensemble reasoning',
    surfaces: ['agent', 'cli', 'web'],
    toolset: 'ensemble',
  },
  'computer-use': {
    category: 'browser',
    purpose: 'Desktop automation via Playwright (high risk, opt-in)',
    surfaces: ['agent', 'cli', 'web', 'playwright'],
    toolset: 'browser',
    optional: true,
  },
  'browser-navigate': {
    category: 'browser',
    purpose: 'Navigate headless browser to a URL',
    surfaces: ['agent', 'cli', 'web', 'playwright', 'subagent'],
    toolset: 'browser',
    optional: true,
  },
  'browser-click': {
    category: 'browser',
    purpose: 'Click element by snapshot ref',
    surfaces: ['agent', 'cli', 'web', 'playwright', 'subagent'],
    toolset: 'browser',
    optional: true,
  },
  'browser-type': {
    category: 'browser',
    purpose: 'Type into browser input fields',
    surfaces: ['agent', 'cli', 'web', 'playwright', 'subagent'],
    toolset: 'browser',
    optional: true,
  },
  'browser-press': {
    category: 'browser',
    purpose: 'Press keyboard keys in the browser',
    surfaces: ['agent', 'cli', 'web', 'playwright', 'subagent'],
    toolset: 'browser',
    optional: true,
  },
  'browser-scroll': {
    category: 'browser',
    purpose: 'Scroll the browser viewport',
    surfaces: ['agent', 'cli', 'web', 'playwright', 'subagent'],
    toolset: 'browser',
    optional: true,
  },
  'browser-snapshot': {
    category: 'browser',
    purpose: 'Capture accessibility-tree page snapshot',
    surfaces: ['agent', 'cli', 'web', 'playwright', 'subagent'],
    toolset: 'browser',
    optional: true,
  },
  'browser-console': {
    category: 'browser',
    purpose: 'Read browser console output or evaluate JS',
    surfaces: ['agent', 'cli', 'web', 'playwright', 'subagent'],
    toolset: 'browser',
    optional: true,
  },
  'browser-back': {
    category: 'browser',
    purpose: 'Navigate back in browser history',
    surfaces: ['agent', 'cli', 'web', 'playwright', 'subagent'],
    toolset: 'browser',
    optional: true,
  },
  'browser-get-images': {
    category: 'browser',
    purpose: 'List images on the current page',
    surfaces: ['agent', 'cli', 'web', 'playwright', 'subagent'],
    toolset: 'browser',
    optional: true,
  },
  'browser-vision': {
    category: 'browser',
    purpose: 'Vision-assisted browser interaction',
    surfaces: ['agent', 'cli', 'web', 'playwright', 'subagent'],
    toolset: 'browser',
    optional: true,
  },
  'browser-cdp': {
    category: 'browser',
    purpose: 'Low-level Chrome DevTools Protocol browser control',
    surfaces: ['agent', 'cli', 'web', 'playwright', 'subagent'],
    toolset: 'browser',
    optional: true,
  },
  'browser-dialog': {
    category: 'browser',
    purpose: 'Handle browser alert/confirm/prompt dialogs',
    surfaces: ['agent', 'cli', 'web', 'playwright', 'subagent'],
    toolset: 'browser',
    optional: true,
  },
  homeassistant: {
    category: 'integrations',
    purpose: 'Home Assistant REST integration (legacy combined tool)',
    surfaces: ['agent', 'cli', 'web'],
    toolset: 'integrations',
  },
  'ha-list-entities': {
    category: 'integrations',
    purpose: 'List Home Assistant entities',
    surfaces: ['agent', 'cli', 'web'],
    toolset: 'integrations',
  },
  'ha-get-state': {
    category: 'integrations',
    purpose: 'Read Home Assistant entity state',
    surfaces: ['agent', 'cli', 'web'],
    toolset: 'integrations',
  },
  'ha-list-services': {
    category: 'integrations',
    purpose: 'List Home Assistant services',
    surfaces: ['agent', 'cli', 'web'],
    toolset: 'integrations',
  },
  'ha-call-service': {
    category: 'integrations',
    purpose: 'Call Home Assistant services',
    surfaces: ['agent', 'cli', 'web'],
    toolset: 'integrations',
  },
  'x-search': {
    category: 'integrations',
    purpose: 'Search X/Twitter',
    surfaces: ['agent', 'cli', 'web'],
    toolset: 'integrations',
  },
  'x-post': {
    category: 'integrations',
    purpose: 'Post to X/Twitter',
    surfaces: ['agent', 'cli', 'web'],
    toolset: 'integrations',
  },
  discord: {
    category: 'integrations',
    purpose: 'Send Discord messages',
    surfaces: ['agent', 'cli', 'web'],
    toolset: 'integrations',
  },
  'discord-admin': {
    category: 'integrations',
    purpose: 'Discord admin actions',
    surfaces: ['agent', 'cli', 'web'],
    toolset: 'integrations',
  },
  'feishu-doc': {
    category: 'integrations',
    purpose: 'Read and write Feishu documents',
    surfaces: ['agent', 'cli', 'web'],
    toolset: 'integrations',
  },
  'feishu-drive': {
    category: 'integrations',
    purpose: 'Browse Feishu drive files',
    surfaces: ['agent', 'cli', 'web'],
    toolset: 'integrations',
  },
  'feishu-chat-send': {
    category: 'integrations',
    purpose: 'Send Feishu chat messages',
    surfaces: ['agent', 'cli', 'web'],
    toolset: 'integrations',
  },
  'feishu-user-lookup': {
    category: 'integrations',
    purpose: 'Look up Feishu users',
    surfaces: ['agent', 'cli', 'web'],
    toolset: 'integrations',
  },
  yuanbao: {
    category: 'integrations',
    purpose: 'Yuanbao Hunyuan API (legacy combined tool)',
    surfaces: ['agent', 'cli', 'web'],
    toolset: 'integrations',
  },
  'yb-chat': {
    category: 'integrations',
    purpose: 'Yuanbao chat completion',
    surfaces: ['agent', 'cli', 'web'],
    toolset: 'integrations',
  },
  'yb-search': {
    category: 'integrations',
    purpose: 'Yuanbao web search',
    surfaces: ['agent', 'cli', 'web'],
    toolset: 'integrations',
  },
  'platform-integrate': {
    category: 'platform',
    purpose: 'Optional macOS integrations (1Password, Apple Notes, Bear, camera)',
    surfaces: ['agent', 'cli', 'platform'],
    toolset: 'integrations',
    optional: true,
  },
  'secrets-audit': {
    category: 'ops',
    purpose: 'Read-only local secrets hygiene audit for operators',
    surfaces: ['agent', 'cli', 'ops'],
    toolset: 'ops',
  },
  domain_lookup: {
    category: 'pack',
    purpose: 'Domain-specific lookup when a vertical pack is active',
    surfaces: ['agent', 'pack'],
    optional: true,
  },
  'json-format': { category: 'utilities', purpose: 'Parse and format JSON', surfaces: ['agent', 'cli', 'web', 'cron'], toolset: 'utilities' },
  'text-hash': { category: 'utilities', purpose: 'Compute text digests', surfaces: ['agent', 'cli', 'web'], toolset: 'utilities' },
  'uuid-generate': { category: 'utilities', purpose: 'Generate UUID v4 values', surfaces: ['agent', 'cli', 'web', 'cron'], toolset: 'utilities' },
  'timestamp-convert': { category: 'utilities', purpose: 'Convert Unix and ISO timestamps', surfaces: ['agent', 'cli', 'web'], toolset: 'utilities' },
  'base64-codec': { category: 'utilities', purpose: 'Base64 encode/decode UTF-8 text', surfaces: ['agent', 'cli', 'web'], toolset: 'utilities' },
  'url-parse': { category: 'utilities', purpose: 'Parse or build URLs', surfaces: ['agent', 'cli', 'web'], toolset: 'utilities' },
  'markdown-to-text': { category: 'utilities', purpose: 'Strip markdown to plain text', surfaces: ['agent', 'cli', 'web', 'cron'], toolset: 'utilities' },
  'text-diff': { category: 'utilities', purpose: 'Line diff between two texts', surfaces: ['agent', 'cli', 'web'], toolset: 'utilities' },
  'random-string': { category: 'utilities', purpose: 'Generate random tokens', surfaces: ['agent', 'cli', 'web'], toolset: 'utilities' },
  'unit-convert': { category: 'utilities', purpose: 'Convert bytes, temperature, distance', surfaces: ['agent', 'cli', 'web'], toolset: 'utilities' },
  'semver-compare': { category: 'utilities', purpose: 'Compare semantic versions', surfaces: ['agent', 'cli', 'web'], toolset: 'utilities' },
  'regex-test': { category: 'utilities', purpose: 'Test regex patterns', surfaces: ['agent', 'cli', 'web'], toolset: 'utilities' },
  'slugify-text': { category: 'utilities', purpose: 'Create URL slugs', surfaces: ['agent', 'cli', 'web'], toolset: 'utilities' },
  'csv-parse': { category: 'utilities', purpose: 'Parse simple CSV', surfaces: ['agent', 'cli', 'web'], toolset: 'utilities' },
  'ip-parse': { category: 'utilities', purpose: 'Validate IP addresses locally', surfaces: ['agent', 'cli', 'web'], toolset: 'utilities' },
  'env-presence': { category: 'utilities', purpose: 'Check env key presence without values', surfaces: ['agent', 'cli', 'ops'], toolset: 'utilities' },
  'cron-explain': { category: 'utilities', purpose: 'Explain cron schedules', surfaces: ['agent', 'cli', 'web', 'cron'], toolset: 'utilities' },
  'rss-fetch': { category: 'utilities', purpose: 'Fetch RSS/Atom feeds', surfaces: ['agent', 'cli', 'web', 'cron'], toolset: 'utilities' },
  'research-list': { category: 'utilities', purpose: 'List saved deep-research reports', surfaces: ['agent', 'cli', 'web'], toolset: 'utilities' },
  'pspp_analyze': {
    category: 'research',
    purpose: 'Run PSPP statistical analysis with APA-formatted output',
    surfaces: ['agent', 'cli', 'web', 'mcp', 'pack'],
    toolset: 'research',
  },
  'jamovi_analyze': {
    category: 'research',
    purpose: 'Run Jamovi/jmv statistical analysis with APA-formatted output',
    surfaces: ['agent', 'cli', 'web', 'mcp', 'pack'],
    toolset: 'research',
  },
  'r_analyze': {
    category: 'research',
    purpose: 'Run R statistical analysis via haven and broom with APA-formatted output',
    surfaces: ['agent', 'cli', 'web', 'mcp', 'pack'],
    toolset: 'research',
  },
  'sav_read': {
    category: 'research',
    purpose: 'Read SPSS .sav files with variable metadata and preview',
    surfaces: ['agent', 'cli', 'web', 'mcp', 'pack'],
    toolset: 'research',
  },
  'sav_write': {
    category: 'research',
    purpose: 'Write SPSS .sav files with labels and value maps',
    surfaces: ['agent', 'cli', 'web', 'mcp', 'pack'],
    toolset: 'research',
  },
  'spv_read': {
    category: 'research',
    purpose: 'Read SPSS .spv output archives',
    surfaces: ['agent', 'cli', 'web', 'mcp', 'pack'],
    toolset: 'research',
  },
  'spss_syntax_generate': {
    category: 'research',
    purpose: 'Generate SPSS/PSPP .sps syntax files',
    surfaces: ['agent', 'cli', 'web', 'mcp', 'pack'],
    toolset: 'research',
  },
  'spss_output_parse': {
    category: 'research',
    purpose: 'Parse SPSS/PSPP .spv or text output into APA tables',
    surfaces: ['agent', 'cli', 'web', 'mcp', 'pack'],
    toolset: 'research',
  },
  'stats_describe': {
    category: 'research',
    purpose: 'Descriptive statistics via Python',
    surfaces: ['agent', 'cli', 'web', 'mcp', 'pack'],
    toolset: 'research',
  },
  'stats_compare_groups': {
    category: 'research',
    purpose: 'T-test, ANOVA, Mann-Whitney, and Kruskal-Wallis via Python',
    surfaces: ['agent', 'cli', 'web', 'mcp', 'pack'],
    toolset: 'research',
  },
  'stats_correlation': {
    category: 'research',
    purpose: 'Correlation matrix via Python',
    surfaces: ['agent', 'cli', 'web', 'mcp', 'pack'],
    toolset: 'research',
  },
  'stats_regression': {
    category: 'research',
    purpose: 'Linear and logistic regression via Python',
    surfaces: ['agent', 'cli', 'web', 'mcp', 'pack'],
    toolset: 'research',
  },
  'stats_chi_square': {
    category: 'research',
    purpose: 'Chi-square test of independence via Python',
    surfaces: ['agent', 'cli', 'web', 'mcp', 'pack'],
    toolset: 'research',
  },
  'stats_normality': {
    category: 'research',
    purpose: 'Normality tests via Python',
    surfaces: ['agent', 'cli', 'web', 'mcp', 'pack'],
    toolset: 'research',
  },
  'stats_posthoc': {
    category: 'research',
    purpose: 'Tukey post-hoc comparisons via Python',
    surfaces: ['agent', 'cli', 'web', 'mcp', 'pack'],
    toolset: 'research',
  },
  'apa_format': {
    category: 'research',
    purpose: 'Format statistical output in APA markdown',
    surfaces: ['agent', 'cli', 'web', 'mcp', 'pack'],
    toolset: 'research',
  },
  'learning-status': { category: 'ops', purpose: 'Self-improvement loop metrics', surfaces: ['agent', 'cli', 'ops'], toolset: 'ops' },
  'capabilities-audit': { category: 'ops', purpose: 'Audit tools/skills/channels vs targets', surfaces: ['agent', 'cli', 'ops'], toolset: 'ops' },
  'channel-status-snapshot': { category: 'ops', purpose: 'Channel health summary', surfaces: ['agent', 'cli', 'ops'], toolset: 'ops' },
  'yaml-json-convert': { category: 'utilities', purpose: 'Convert YAML and JSON', surfaces: ['agent', 'cli', 'web'], toolset: 'utilities' },
  'color-convert': { category: 'utilities', purpose: 'Convert hex and RGB colors', surfaces: ['agent', 'cli', 'web'], toolset: 'utilities' },
  'git-brief-status': { category: 'utilities', purpose: 'Read-only git status', surfaces: ['agent', 'cli', 'web'], toolset: 'utilities' },
  'disk-usage': { category: 'utilities', purpose: 'Local path size summary', surfaces: ['agent', 'cli', 'web'], toolset: 'utilities' },
  'hex-encode': { category: 'utilities', purpose: 'Hex encode/decode UTF-8 text', surfaces: ['agent', 'cli', 'web'], toolset: 'utilities' },
  'n8n': { category: 'integrations', purpose: 'Trigger and monitor n8n workflow automations', surfaces: ['agent', 'web'], toolset: 'integrations' },
  'phone-control': { category: 'infrastructure', purpose: 'Dispatch shell commands to a paired phone node', surfaces: ['agent'], toolset: 'system' },
  'theme': { category: 'utilities', purpose: 'Set, list, or reset the workspace color theme', surfaces: ['agent', 'web'], toolset: 'utilities' },
  'trello': { category: 'integrations', purpose: 'Manage Trello boards, lists, and cards', surfaces: ['agent', 'web'], toolset: 'integrations' },

  // Self-config: credential store (sprint 1)
  'configure_credential': { category: 'security', purpose: 'Store an encrypted API credential in the secure credential store', surfaces: ['agent'], toolset: 'self-config' },
  'list_credentials':     { category: 'security', purpose: 'List stored credentials by service and key name (values masked)', surfaces: ['agent'], toolset: 'self-config' },
  'test_credential':      { category: 'security', purpose: 'Test a stored credential against its provider endpoint', surfaces: ['agent'], toolset: 'self-config' },
  'remove_credential':    { category: 'security', purpose: 'Delete a stored credential from the credential store', surfaces: ['agent'], toolset: 'self-config' },
  'tool_status':          { category: 'security', purpose: 'Report credential coverage and tool readiness for all registered tools', surfaces: ['agent'], toolset: 'self-config' },

  // Self-config: dynamic tool generation (sprints 2-3)
  'setup_tool_gen_auth':   { category: 'security', purpose: 'Set or rotate the operator passphrase that gates dynamic tool generation', surfaces: ['agent'], toolset: 'dynamic' },
  'generate_and_run_tool': { category: 'ai',       purpose: 'Generate and sandbox-execute a new tool via LLM given a task description', surfaces: ['agent'], toolset: 'dynamic' },
  'persist_runtime_tool':  { category: 'ai',       purpose: 'Persist a successfully-generated sandbox tool to the database for reuse', surfaces: ['agent'], toolset: 'dynamic' },
  'approve_runtime_tool':  { category: 'security', purpose: 'Approve and activate a pending runtime-generated tool in the live registry', surfaces: ['agent'], toolset: 'dynamic' },
};

function resolveToolset(name: string): string | undefined {
  for (const [set, tools] of Object.entries(TOOLSET_MAP)) {
    if (tools.includes(name)) return set;
  }
  return TOOL_META[name]?.toolset;
}

export function buildToolSurfaceCatalog(): ToolCatalogEntry[] {
  const registered = new Map(registry.list().map((t) => [t.name, t]));
  const names = new Set([
    ...Object.keys(TOOL_META),
    ...registered.keys(),
    ...Object.values(TOOLSET_MAP).flat(),
  ]);

  return [...names]
    .sort((a, b) => a.localeCompare(b))
    .map((name) => {
      const tool = registered.get(name);
      const meta = TOOL_META[name];
      const risk = lookupToolRisk(name);
      const catalogPurpose = meta?.purpose
        ?? registry.getMeta(name)?.compactDescription
        ?? getCompactToolDescription(name, tool?.description);
      return {
        name,
        category: meta?.category ?? 'unclassified',
        purpose: catalogPurpose,
        surfaces: meta?.surfaces ?? ['agent'],
        toolset: meta?.toolset ?? resolveToolset(name),
        optional: meta?.optional,
        registered: Boolean(tool),
        riskClass: risk?.riskClass,
      };
    });
}

export function summarizeToolCatalog(entries = buildToolSurfaceCatalog()): {
  totalCatalogued: number;
  registered: number;
  optional: number;
  byCategory: Record<string, number>;
  bySurface: Record<ToolSurface, number>;
} {
  const registeredEntries = entries.filter((e) => e.registered);
  const byCategory: Record<string, number> = {};
  const bySurface: Record<ToolSurface, number> = {
    agent: 0,
    cli: 0,
    web: 0,
    mcp: 0,
    cron: 0,
    subagent: 0,
    playwright: 0,
    ops: 0,
    pack: 0,
    platform: 0,
  };

  for (const entry of registeredEntries) {
    byCategory[entry.category] = (byCategory[entry.category] ?? 0) + 1;
    for (const surface of entry.surfaces) {
      bySurface[surface]++;
    }
  }

  return {
    totalCatalogued: entries.length,
    registered: registeredEntries.length,
    optional: registeredEntries.filter((e) => e.optional).length,
    byCategory,
    bySurface,
  };
}

export function findCatalogGaps(entries = buildToolSurfaceCatalog()): {
  registeredWithoutMeta: string[];
  metaWithoutRegistration: string[];
} {
  return {
    registeredWithoutMeta: entries
      .filter((e) => e.registered && !TOOL_META[e.name])
      .map((e) => e.name),
    metaWithoutRegistration: entries
      .filter((e) => TOOL_META[e.name] && !e.registered && !TOOL_META[e.name]?.optional)
      .map((e) => e.name),
  };
}
