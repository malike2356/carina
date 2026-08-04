import type { AivaPaidTier } from '../billing/aiva-tier.js';
import { tierDisplayLabel } from '../billing/aiva-tier.js';

export type ToolInactiveReason =
  | 'credential_missing'
  | 'embedding_filtered'
  | 'plan_mode_blocked'
  | 'unknown';

export type ToolCapabilityEntry = {
  name: string;
  description: string;
  category: string;
  credentialRequired: string | null;
  credentialStatus: 'ready' | 'missing' | 'degraded';
  riskClass: 'safe' | 'dangerous' | 'destructive';
  requiresConfirmation: boolean;
};

export type ChannelEntry = {
  id: string;
  name: string;
  icon: string;
  connected: boolean;
  setupTime: string;
};

export type SkillEntry = {
  name: string;
  description: string;
  category: string;
};

export type ExtensionEntry = {
  name: string;
  description: string;
  providesCapabilities: string[];
};

export type CapabilityManifest = {
  generatedAt: string;
  sessionId: string;
  workspaceId: string | null;
  summary: {
    totalToolsActive: number;
    totalToolsAvailable: number;
    totalSkillsActive: number;
    totalChannelsConnected: number;
    totalExtensionsActive: number;
    totalRagDocuments: number;
    ragDomains: string[];
  };
  tools: {
    active: ToolCapabilityEntry[];
    inactiveReason: Record<string, ToolInactiveReason>;
    categories: Record<string, number>;
  };
  channels: {
    connected: ChannelEntry[];
    available: ChannelEntry[];
  };
  skills: {
    active: SkillEntry[];
    categories: Record<string, number>;
  };
  extensions: {
    active: ExtensionEntry[];
  };
  knowledge: {
    documentCount: number;
    domains: string[];
    totalTokens: number;
    lastUpdated: string | null;
  };
  credentials: {
    configured: string[];
    missing: string[];
    degraded: string[];
  };
  platform: {
    tier: AivaPaidTier | 'trial' | 'operator';
    tierLabel: string;
    slotLimit: number | null;
    slotsUsed: number;
    features: string[];
  };
  scout: {
    connected: boolean;
    profile: string;
    activePolicies: string[];
    lastSignalAt: string | null;
  };
};

export function emptyManifest(sessionId: string, workspaceId: string | null = null): CapabilityManifest {
  return {
    generatedAt: new Date().toISOString(),
    sessionId,
    workspaceId,
    summary: {
      totalToolsActive: 0,
      totalToolsAvailable: 0,
      totalSkillsActive: 0,
      totalChannelsConnected: 0,
      totalExtensionsActive: 0,
      totalRagDocuments: 0,
      ragDomains: [],
    },
    tools: {
      active: [],
      inactiveReason: {},
      categories: {},
    },
    channels: {
      connected: [],
      available: [],
    },
    skills: {
      active: [],
      categories: {},
    },
    extensions: {
      active: [],
    },
    knowledge: {
      documentCount: 0,
      domains: [],
      totalTokens: 0,
      lastUpdated: null,
    },
    credentials: {
      configured: [],
      missing: [],
      degraded: [],
    },
    platform: {
      tier: 'trial',
      tierLabel: tierDisplayLabel('trial'),
      slotLimit: 1,
      slotsUsed: 0,
      features: [],
    },
    scout: {
      connected: process.env.LABYRINTH_ENABLED === 'true',
      profile: process.env.SCOUT_PROFILE ?? 'standard',
      activePolicies: [],
      lastSignalAt: null,
    },
  };
}
