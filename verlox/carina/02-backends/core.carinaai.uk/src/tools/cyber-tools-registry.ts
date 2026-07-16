// Aiva security tools - defensive and compliance only.
// Active/offensive tools (recon, vuln scan, exploit, wireless, forensics,
// traffic capture, reverse engineering) are in Petraclus.

import { WorkspaceTier } from './tiers.js';

export interface CyberToolDef {
  name: string;
  category: string;
  requiredTier: WorkspaceTier;
  description: string;
  triggers: string[];
  upgradeNote?: string | null;
  binary: string;
  buildArgs?: (target: string) => string[];
}

const AIVA_SECURITY_TOOL_DEFS: CyberToolDef[] = [
  {
    name: 'snort',
    category: 'blue-team-defense',
    requiredTier: WorkspaceTier.MONITOR,
    description: 'IDS/IPS network monitoring with Snort rule sets.',
    triggers: ['snort', 'ids', 'ips', 'intrusion detection'],
    binary: 'snort',
  },
  {
    name: 'bloodhound',
    category: 'blue-team-defense',
    requiredTier: WorkspaceTier.MONITOR,
    description: 'Active Directory attack path mapping and collection.',
    triggers: ['bloodhound', 'ad map', 'attack path', 'domain admin path'],
    upgradeNote: 'AD enumeration is detectable; requires scoped authorization.',
    binary: 'bloodhound-python',
  },
  {
    name: 'log2timeline',
    category: 'reporting-tip',
    requiredTier: WorkspaceTier.MONITOR,
    description: 'Plaso super-timeline creation from disk images (log2timeline.py).',
    triggers: ['log2timeline', 'super timeline', 'plaso timeline'],
    binary: 'log2timeline.py',
  },
  {
    name: 'timesketch',
    category: 'reporting-tip',
    requiredTier: WorkspaceTier.MONITOR,
    description: 'Collaborative forensic timeline search via Timesketch REST API.',
    triggers: ['timesketch', 'timeline search', 'forensic search'],
    upgradeNote: 'Requires Timesketch server. Set TIMESKETCH_URL and TIMESKETCH_API_KEY.',
    binary: 'timesketch',
  },
  {
    name: 'stix',
    category: 'reporting-tip',
    requiredTier: WorkspaceTier.MONITOR,
    description: 'Export findings as STIX 2.1 bundles for threat intelligence sharing.',
    triggers: ['stix', 'threat intel export', 'tip export'],
    binary: 'python3',
  },
  {
    name: 'cyberchef',
    category: 'reporting-tip',
    requiredTier: WorkspaceTier.MONITOR,
    description: 'Programmatic CyberChef data transformation recipes.',
    triggers: ['cyberchef', 'data transform', 'recipe bake'],
    upgradeNote: 'Requires CyberChef server. Set CYBERCHEF_URL (default http://127.0.0.1:3000).',
    binary: 'cyberchef',
  },
  {
    name: 'mat2',
    category: 'privacy-opsec',
    requiredTier: WorkspaceTier.MONITOR,
    description: 'Strip EXIF and metadata from files before sharing.',
    triggers: ['mat2', 'metadata strip', 'exif remove'],
    binary: 'mat2',
  },
  {
    name: 'bleachbit',
    category: 'privacy-opsec',
    requiredTier: WorkspaceTier.MONITOR,
    description: 'Secure cleaning of browser history, caches, logs, and temp files.',
    triggers: ['bleachbit', 'secure clean', 'anti-forensics clean'],
    upgradeNote: 'Cleaning permanently removes local artifacts; requires approval.',
    binary: 'bleachbit',
  },
];

export const AIVA_SECURITY_TOOLS: CyberToolDef[] = AIVA_SECURITY_TOOL_DEFS;

const LEGACY_CYBER_GROUPS: Array<{
  names: string[];
  category: string;
  requiredTier: WorkspaceTier;
}> = [
  {
    names: ['nmap', 'amass', 'theHarvester', 'recon-ng', 'spiderfoot', 'sherlock', 'maltego', 'dmitry', 'metagoofil', 'cewl'],
    category: 'recon',
    requiredTier: WorkspaceTier.SELF_HOSTED,
  },
  {
    names: ['nuclei', 'nikto', 'sqlmap', 'wpscan', 'whatweb', 'yersinia', 'legion'],
    category: 'vulnerability',
    requiredTier: WorkspaceTier.CLOUD,
  },
  {
    names: ['metasploit', 'impacket', 'hydra', 'john', 'hashcat', 'evil-winrm', 'crackmapexec', 'mimikatz'],
    category: 'exploit',
    requiredTier: WorkspaceTier.MONITOR,
  },
  {
    names: ['burpsuite', 'ffuf', 'dirsearch', 'feroxbuster', 'gobuster', 'arjun', 'sstimap'],
    category: 'web-security',
    requiredTier: WorkspaceTier.MONITOR,
  },
  {
    names: ['aircrack-ng', 'bettercap', 'kismet', 'wifite', 'ettercap'],
    category: 'wireless',
    requiredTier: WorkspaceTier.MONITOR,
  },
  {
    names: ['autopsy', 'volatility3', 'dc3dd', 'sleuthkit', 'binwalk', 'ghidra', 'bulk-extractor', 'yara', 'guymager', 'rekall', 'foremost', 'plasmo', 'xplico', 'regripper', 'hashdeep', 'ollydbg'],
    category: 'forensic',
    requiredTier: WorkspaceTier.MONITOR,
  },
  {
    names: ['tshark', 'tcpdump', 'dsniff', 'responder', 'scapy'],
    category: 'traffic-analysis',
    requiredTier: WorkspaceTier.MONITOR,
  },
  {
    names: ['anonsurf', 'tor', 'gparted'],
    category: 'privacy-opsec',
    requiredTier: WorkspaceTier.MONITOR,
  },
  {
    names: ['radare2', 'cutter', 'vscodium'],
    category: 'reverse-engineering',
    requiredTier: WorkspaceTier.MONITOR,
  },
];

const AIVA_NAMES = new Set(AIVA_SECURITY_TOOLS.map((tool) => tool.name));
const LEGACY_CYBER_TOOL_DEFS: CyberToolDef[] = LEGACY_CYBER_GROUPS.flatMap((group) =>
  group.names
    .filter((name) => !AIVA_NAMES.has(name))
    .map((name) => ({
      name,
      category: group.category,
      requiredTier: group.requiredTier,
      description: `${name} security tool integration.`,
      triggers: [name],
      binary: name,
    })));

const BY_NAME = new Map(
  [...AIVA_SECURITY_TOOLS, ...LEGACY_CYBER_TOOL_DEFS].map((tool) => [tool.name, tool]),
);

export function getCyberToolDef(name: string): CyberToolDef | undefined {
  return BY_NAME.get(name);
}

export function listCyberToolNames(): string[] {
  return AIVA_SECURITY_TOOLS.map((t) => t.name);
}
