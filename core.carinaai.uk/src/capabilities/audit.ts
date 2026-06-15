import { getChannelStatusReports, type ChannelStatusReport } from '../gateway/channels/channel-status.js';
import { warmPackSkillIndex, getBuiltinSkillNames } from '../skills/pack-resolver.js';
import { listKnownPackNames } from '../skills/pack-manifests.js';

export const CAPABILITY_TARGETS = {
  tools: 99,
  skills: 115,
  channels: 50,
} as const;

export type CapabilityGapStatus = 'met' | 'narrow' | 'wide';

export type CapabilityAuditReport = {
  generatedAt: string;
  targets: typeof CAPABILITY_TARGETS;
  tools: {
    registered: number;
    catalogued: number;
    optional: number;
    gap: number;
    status: CapabilityGapStatus;
    unregistered: string[];
    missingMetadata: string[];
    byCategory: Record<string, number>;
  };
  skills: {
    builtin: number;
    packs: number;
    gap: number;
    status: CapabilityGapStatus;
  };
  channels: {
    total: number;
    connected: number;
    configured: number;
    partial: number;
    disabled: number;
    unsupported: number;
    gap: number;
    status: CapabilityGapStatus;
    reports: ChannelStatusReport[];
  };
  health: {
    toolCatalogComplete: boolean;
    channelDiscoveryReady: boolean;
    skillsIndexed: boolean;
  };
};

function gapStatus(current: number, target: number): CapabilityGapStatus {
  if (current >= target) return 'met';
  if (current >= target - 10) return 'narrow';
  return 'wide';
}

export async function buildCapabilityAudit(): Promise<CapabilityAuditReport> {
  const { findCatalogGaps, summarizeToolCatalog } = await import('../tools/tool-surface-catalog.js');
  const { findUnregisteredTools } = await import('../tools/tool-inventory.js');
  await warmPackSkillIndex();
  const toolSummary = summarizeToolCatalog();
  const catalogGaps = findCatalogGaps();
  const unregistered = findUnregisteredTools();
  const skillCount = getBuiltinSkillNames().size;
  const channelReports = getChannelStatusReports();

  const channelCounts = {
    connected: 0,
    configured: 0,
    partial: 0,
    disabled: 0,
    unsupported: 0,
    error: 0,
  };
  for (const report of channelReports) {
    channelCounts[report.state] += 1;
  }

  const toolsRegistered = toolSummary.registered;
  const channelsTotal = channelReports.length;

  return {
    generatedAt: new Date().toISOString(),
    targets: CAPABILITY_TARGETS,
    tools: {
      registered: toolsRegistered,
      catalogued: toolSummary.totalCatalogued,
      optional: toolSummary.optional,
      gap: Math.max(0, CAPABILITY_TARGETS.tools - toolsRegistered),
      status: gapStatus(toolsRegistered, CAPABILITY_TARGETS.tools),
      unregistered,
      missingMetadata: catalogGaps.registeredWithoutMeta,
      byCategory: toolSummary.byCategory,
    },
    skills: {
      builtin: skillCount,
      packs: listKnownPackNames().length,
      gap: Math.max(0, CAPABILITY_TARGETS.skills - skillCount),
      status: gapStatus(skillCount, CAPABILITY_TARGETS.skills),
    },
    channels: {
      total: channelsTotal,
      ...channelCounts,
      gap: Math.max(0, CAPABILITY_TARGETS.channels - channelsTotal),
      status: gapStatus(channelsTotal, CAPABILITY_TARGETS.channels),
      reports: channelReports,
    },
    health: {
      toolCatalogComplete: catalogGaps.registeredWithoutMeta.length === 0 && unregistered.length === 0,
      channelDiscoveryReady: channelsTotal >= CAPABILITY_TARGETS.channels,
      skillsIndexed: skillCount > 0,
    },
  };
}

export function listRegisteredTools(entries: Array<{ registered: boolean }>): Array<{ registered: boolean }> {
  return entries.filter((entry) => entry.registered);
}
