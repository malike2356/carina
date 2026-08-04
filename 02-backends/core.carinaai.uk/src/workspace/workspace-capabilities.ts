import { normalizeAivaTier } from '../billing/aiva-tier.js';
import { TOOLSET_NAMES } from '../tools/toolset.js';

/**
 * Every workspace gets full Carina capabilities.
 * Templates determine starting configuration, not the ceiling.
 */
export const WORKSPACE_SECURITY_BLOCKED_TOOLSETS = ['terminal', 'security'] as const;

export const WORKSPACE_SECURITY_BLOCKED_TOOLS = [
  // Host-scoped memory / sync: leak other tenants on shared Core.
  'session-search',
  'memory',
  'agent-sync',
  'github-agent-sync',
  // Host cron / research / gallery stores are not workspace-scoped.
  'cronjob',
  'research-list',
  'images-gallery',
  'shell-exec',
  'process',
  'nmap',
  'amass',
  'theHarvester',
  'recon-ng',
  'spiderfoot',
  'sherlock',
  'maltego',
  'dmitry',
  'metagoofil',
  'cewl',
  'shodan',
  'censys',
  'masscan',
  'curl',
  'netcat',
  'nuclei',
  'nikto',
  'sqlmap',
  'wpscan',
  'whatweb',
  'yersinia',
  'legion',
  'metasploit',
  'impacket',
  'hydra',
  'john',
  'hashcat',
  'evil-winrm',
  'crackmapexec',
  'mimikatz',
  'burpsuite',
  'ffuf',
  'dirsearch',
  'feroxbuster',
  'gobuster',
  'arjun',
  'sstimap',
  'aircrack-ng',
  'bettercap',
  'kismet',
  'wifite',
  'ettercap',
  'autopsy',
  'volatility3',
  'dc3dd',
  'sleuthkit',
  'binwalk',
  'ghidra',
  'bulk-extractor',
  'yara',
  'guymager',
  'rekall',
  'foremost',
  'plasmo',
  'xplico',
  'regripper',
  'hashdeep',
  'ollydbg',
  'tshark',
  'tcpdump',
  'dsniff',
  'responder',
  'scapy',
  'anonsurf',
  'tor',
  'mat2',
  'bleachbit',
  'gparted',
  'radare2',
  'cutter',
  'vscodium',
  'snort',
  'bloodhound',
  'log2timeline',
  'timesketch',
  'stix',
  'cyberchef',
] as const;

export type WorkspaceChannelKey =
  | 'webchat'
  | 'telegram'
  | 'whatsapp'
  | 'email'
  | 'slack'
  | 'sms';

export type WorkspacePlatformFeature =
  | 'customDomain'
  | 'whiteLabel'
  | 'api'
  | 'teams'
  | 'analytics'
  | 'audit';

export interface WorkspaceCapabilities {
  agent: true;
  memory: true;
  skills: true;
  channels: Record<WorkspaceChannelKey, true>;
  tools: {
    webSearch: true;
    webExtract: true;
    fileRead: true;
    fileWrite: true;
    spreadsheetRead: true;
    spreadsheetWrite: true;
    calendarRead: true;
    calendarCreate: true;
    emailRead: true;
    emailSend: true;
    crmRead: true;
    crmWrite: true;
    notionRead: true;
    notionWrite: true;
  };
  platform: Record<WorkspacePlatformFeature, boolean>;
}

export interface WorkspaceToolsetConfig {
  toolsets: string[];
  blockedTools: string[];
}

function normalizeWorkspaceTier(tier: string): string {
  return normalizeAivaTier(tier);
}

function tierHasGrowthFeatures(tier: string): boolean {
  const normalized = normalizeWorkspaceTier(tier);
  if (normalized === 'trial') return true;
  return ['growth', 'team', 'business', 'professional'].includes(normalized);
}

function tierHasBusinessFeatures(tier: string): boolean {
  return normalizeWorkspaceTier(tier) === 'business';
}

export function allWorkspaceToolsets(): string[] {
  const blocked = new Set<string>(WORKSPACE_SECURITY_BLOCKED_TOOLSETS);
  return TOOLSET_NAMES.filter((name) => !blocked.has(name));
}

export function isWorkspaceToolBlocked(toolName: string): boolean {
  return (WORKSPACE_SECURITY_BLOCKED_TOOLS as readonly string[]).includes(toolName);
}

export function isWorkspaceToolsetBlocked(toolset: string): boolean {
  return (WORKSPACE_SECURITY_BLOCKED_TOOLSETS as readonly string[]).includes(toolset);
}

export function getWorkspaceCapabilities(tier: string): WorkspaceCapabilities {
  const growth = tierHasGrowthFeatures(tier);
  const business = tierHasBusinessFeatures(tier);

  return {
    agent: true,
    memory: true,
    skills: true,
    channels: {
      webchat: true,
      telegram: true,
      whatsapp: true,
      email: true,
      slack: true,
      sms: true,
    },
    tools: {
      webSearch: true,
      webExtract: true,
      fileRead: true,
      fileWrite: true,
      spreadsheetRead: true,
      spreadsheetWrite: true,
      calendarRead: true,
      calendarCreate: true,
      emailRead: true,
      emailSend: true,
      crmRead: true,
      crmWrite: true,
      notionRead: true,
      notionWrite: true,
    },
    platform: {
      customDomain: business,
      whiteLabel: business,
      api: growth,
      teams: growth,
      analytics: true,
      audit: true,
    },
  };
}

export function isPlatformFeatureEnabled(tier: string, feature: WorkspacePlatformFeature): boolean {
  return getWorkspaceCapabilities(tier).platform[feature];
}

/** All workspaces may connect any channel; billing tier does not cap channels. */
export function channelLimitFromCapabilities(_tier: string): number | null {
  return null;
}

export function getWorkspaceToolsetConfig(_tier: string): WorkspaceToolsetConfig {
  return {
    toolsets: allWorkspaceToolsets(),
    blockedTools: [],
  };
}

export function isWorkspaceToolAllowed(toolName: string, _tier: string): boolean {
  return !isWorkspaceToolBlocked(toolName);
}

export function filterWorkspaceTools(resolvedToolNames: string[], tier: string): string[] {
  return resolvedToolNames.filter((name) => isWorkspaceToolAllowed(name, tier));
}
