export type WorkspaceSetupTip = {
  title: string;
  body: string;
  actionUrl: string;
  actionLabel: string;
};

export type WorkspaceHomeWorker = {
  id: string;
  name: string;
  roleDescription: string;
  connectedChannelCount: number;
  installedToolCount: number;
  installedSkillCount: number;
  hasKnowledge: boolean;
};

export type WorkspaceCapabilitiesPayload = {
  planTier: string;
  capabilities: {
    agent: true;
    memory: true;
    skills: true;
    channels: Record<string, true>;
    tools: Record<string, true>;
    platform: Record<string, boolean>;
  };
  setupTip: WorkspaceSetupTip | null;
  templateDomain: string | null;
  worker: WorkspaceHomeWorker | null;
};

export type TemplateDomain =
  | 'property_management'
  | 'customer_support'
  | 'sales_outreach'
  | 'finance_admin'
  | 'calendar_management';

export const ALL_CAPABILITY_CARDS = [
  { id: 'web-search', title: 'Web Search', description: 'Search the internet', href: '/aiva/workers' },
  { id: 'files', title: 'Files', description: 'Read and write files', href: '/files' },
  { id: 'spreadsheets', title: 'Spreadsheets', description: 'Track data', href: '/documents' },
  { id: 'calendar', title: 'Calendar', description: 'Schedule and remind', href: '/channels/calendar' },
  { id: 'integrations', title: 'Integrations', description: 'Connect your tools', href: '/channels' },
  { id: 'memory', title: 'Memory', description: 'Your AI remembers', href: '/knowledge' },
  { id: 'scout', title: 'Scout', description: 'Security dashboard', href: '/settings/governance' },
  { id: 'settings', title: 'Settings', description: 'Customise everything', href: '/settings' },
] as const;
