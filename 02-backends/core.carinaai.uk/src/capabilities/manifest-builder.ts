import { normalizeAivaTier, slotLimitForTier, tierDisplayLabel } from '../billing/aiva-tier.js';
import { getAivaScoutWorkspace } from '../billing/aiva-scout-store.js';
import { TOOL_CAPABILITIES } from '../credentials/tool-capabilities.js';
import { resolveCredential } from '../credentials/resolver.js';
import { getActiveExtensions } from '../extensions/registry.js';
import { getChannelStatusReports } from '../gateway/channels/channel-status.js';
import { pool } from '../memory/db.js';
import { getWorkspaceRagStatus } from '../rag/status.js';
import { isPlanModeAllowed } from '../security/plan-mode-allowlist.js';
import { resolvePlanMode } from '../security/plan-mode-state.js';
import { getToolExecutionContext } from '../security/tool-execution-context.js';
import { toolRiskTier } from '../security/tool-risk.js';
import { getActivePackNames } from '../skills/index.js';
import { PACK_MANIFESTS } from '../skills/pack-manifests.js';
import { registry } from '../tools/registry.js';
import { inferToolset } from '../tools/registry.js';
import { buildToolSurfaceCatalog } from '../tools/tool-surface-catalog.js';
import { resolveSessionTools } from '../tools/session-tool-resolution.js';
import type { Tool } from '../types/index.js';
import type {
  CapabilityManifest,
  ChannelEntry,
  SkillEntry,
  ToolCapabilityEntry,
  ToolInactiveReason,
} from './capability-manifest.js';
import { emptyManifest } from './capability-manifest.js';
import { getAggregateCredentialStatus } from './credential-status.js';

const manifestCache = new Map<string, { expiresAt: number; manifest: CapabilityManifest }>();
const CACHE_TTL_MS = 30_000;

const CHANNEL_LABELS: Record<string, string> = {
  telegram: 'Telegram',
  discord: 'Discord',
  slack: 'Slack',
  whatsapp: 'WhatsApp',
  email: 'Email',
  web: 'Web',
  sms: 'SMS',
  signal: 'Signal',
  matrix: 'Matrix',
  linkedin: 'LinkedIn',
  instagram: 'Instagram',
  messenger: 'Messenger',
  twitter: 'X',
  tiktok: 'TikTok',
};

const CHANNEL_SETUP: Record<string, string> = {
  web: '5s',
  telegram: '30s',
  email: '60s',
  whatsapp: '60s',
};

function normalizeToolName(name: string): string {
  return name.trim().toLowerCase().replace(/-/g, '_');
}

function findCapabilityEntry(toolName: string) {
  const needle = normalizeToolName(toolName);
  return TOOL_CAPABILITIES.find((row) => normalizeToolName(row.tool_name) === needle);
}

function categorizeTool(toolName: string): string {
  return inferToolset(toolName) ?? 'tools';
}

function catalogDescription(tool: Tool): string {
  const catalog = buildToolSurfaceCatalog().find((e) => e.name === tool.name);
  const meta = registry.getMeta(tool.name);
  const raw = catalog?.purpose ?? meta?.compactDescription ?? tool.description ?? tool.name;
  return raw.length > 160 ? `${raw.slice(0, 157)}...` : raw;
}

async function credentialStatusForTool(toolName: string): Promise<{
  credentialRequired: string | null;
  credentialStatus: ToolCapabilityEntry['credentialStatus'];
}> {
  const entry = findCapabilityEntry(toolName);
  if (!entry || entry.required_credentials.length === 0) {
    return { credentialRequired: null, credentialStatus: 'ready' };
  }
  const missing: string[] = [];
  for (const cred of entry.required_credentials) {
    const value = await resolveCredential(cred);
    if (!value) missing.push(cred);
  }
  if (missing.length === 0) {
    return { credentialRequired: entry.required_credentials[0] ?? null, credentialStatus: 'ready' };
  }
  return {
    credentialRequired: missing[0] ?? entry.required_credentials[0] ?? null,
    credentialStatus: missing.length === entry.required_credentials.length ? 'missing' : 'degraded',
  };
}

function gatewayChannels(): { connected: ChannelEntry[]; available: ChannelEntry[] } {
  const connected: ChannelEntry[] = [];
  const available: ChannelEntry[] = [];
  for (const report of getChannelStatusReports()) {
    const entry: ChannelEntry = {
      id: report.channel,
      name: CHANNEL_LABELS[report.channel] ?? report.channel,
      icon: report.channel,
      connected: report.state === 'connected',
      setupTime: CHANNEL_SETUP[report.channel] ?? '30s',
    };
    if (entry.connected) connected.push(entry);
    else available.push(entry);
  }
  return { connected, available };
}

async function workspaceWorkerChannels(workspaceId: string): Promise<ChannelEntry[]> {
  try {
    const result = await pool.query(
      `SELECT DISTINCT channel,
              BOOL_OR(enabled) AS enabled,
              BOOL_OR(identifier IS NOT NULL AND identifier != 'pending' AND credentials IS NOT NULL) AS configured
       FROM ai_worker_channels
       WHERE workspace_id = $1
       GROUP BY channel
       ORDER BY channel`,
      [workspaceId],
    );
    return result.rows.map((row) => {
      const channel = String((row as { channel: string }).channel);
      const enabled = Boolean((row as { enabled?: boolean }).enabled);
      const configured = Boolean((row as { configured?: boolean }).configured);
      return {
        id: channel,
        name: CHANNEL_LABELS[channel] ?? channel,
        icon: channel,
        connected: enabled && configured,
        setupTime: CHANNEL_SETUP[channel] ?? '30s',
      };
    });
  } catch {
    return [];
  }
}

function activeSkillsFromPacks(): SkillEntry[] {
  return getActivePackNames().map((packName) => {
    const manifest = PACK_MANIFESTS[packName];
    return {
      name: manifest?.name ?? packName,
      description: manifest?.description ?? `Skill pack: ${packName}`,
      category: manifest?.category ?? 'pack',
    };
  });
}

function groupByCategory<T extends { category: string }>(items: T[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of items) {
    out[item.category] = (out[item.category] ?? 0) + 1;
  }
  return out;
}

function tierFeatures(tier: CapabilityManifest['platform']['tier']): string[] {
  if (tier === 'operator') return ['full_tool_catalog', 'cli', 'extensions', 'skill_packs'];
  if (tier === 'trial') return ['aiva_workers', 'basic_channels', 'scout_pending'];
  const normalized = normalizeAivaTier(tier);
  const base = ['aiva_workers', 'email_handler', 'scout_governance'];
  if (normalized === 'starter') return [...base, 'two_worker_slots'];
  if (normalized === 'growth' || normalized === 'team') return [...base, 'five_worker_slots', 'team_channels'];
  if (normalized === 'business') return [...base, 'unlimited_workers', 'custom_domain', 'advanced_governance'];
  return base;
}

async function resolvePlatformTier(workspaceId: string | null): Promise<CapabilityManifest['platform']> {
  if (!workspaceId) {
    return {
      tier: 'operator',
      tierLabel: 'Operator install',
      slotLimit: null,
      slotsUsed: 0,
      features: tierFeatures('operator'),
    };
  }
  try {
    const { getSubscriptionStatus } = await import('../workers/aiva-subscription-store.js');
    const status = await getSubscriptionStatus(workspaceId);
    const tier = normalizeAivaTier(String(status.planTier ?? 'trial'));
    return {
      tier,
      tierLabel: tierDisplayLabel(tier),
      slotLimit: slotLimitForTier(tier),
      slotsUsed: Number(status.aivasUsed ?? 0),
      features: tierFeatures(tier),
    };
  } catch {
    const envTier = normalizeAivaTier(process.env.AIVA_PLAN_TIER ?? process.env.CARINA_BILLING_PLAN ?? 'trial');
    return {
      tier: envTier,
      tierLabel: tierDisplayLabel(envTier),
      slotLimit: slotLimitForTier(envTier),
      slotsUsed: 0,
      features: tierFeatures(envTier),
    };
  }
}

async function resolveScoutBlock(workspaceId: string | null): Promise<CapabilityManifest['scout']> {
  if (!workspaceId) {
    return {
      connected: Boolean(process.env.SCOUT_API_KEY) || process.env.LABYRINTH_ENABLED === 'true',
      profile: process.env.SCOUT_PROFILE ?? 'standard',
      activePolicies: process.env.LABYRINTH_ENABLED === 'true' ? ['egress_filter', 'tool_policy'] : [],
      lastSignalAt: null,
    };
  }
  const scout = await getAivaScoutWorkspace(workspaceId);
  const connected = scout?.scoutStatus === 'connected' || process.env.LABYRINTH_ENABLED === 'true';
  let profile = process.env.SCOUT_PROFILE ?? 'standard';
  if (workspaceId) {
    try {
      const gov = await pool.query(
        'SELECT volume_spike_threshold FROM aiva_scout_governance WHERE workspace_id = $1',
        [workspaceId],
      );
      if (gov.rows.length > 0) profile = 'high';
    } catch {
      // optional
    }
  }
  return {
    connected,
    profile,
    activePolicies: connected ? ['kill_switch', 'audit_trail', 'heartbeat', 'egress_filter'] : [],
    lastSignalAt: scout?.scoutLastHeartbeatAt?.toISOString() ?? null,
  };
}

export type BuildCapabilityManifestOpts = {
  sessionId: string;
  workspaceId?: string | null;
  platform?: string;
  explicitAllowed?: string[];
  userMessage?: string;
  provider?: string;
  model?: string;
  forceRefresh?: boolean;
};

async function buildToolsSection(
  sessionId: string,
  resolvedTools: Tool[],
  embeddingFiltered: boolean,
): Promise<CapabilityManifest['tools']> {
  const allTools = registry.list();
  const activeNames = new Set(resolvedTools.map((t) => t.name));
  const executionContext = getToolExecutionContext();
  const planMode = resolvePlanMode({
    sessionId,
    orgRole: executionContext.orgRole,
    contextPlanMode: executionContext.planMode,
  });

  const active: ToolCapabilityEntry[] = [];
  const inactiveReason: Record<string, ToolInactiveReason> = {};
  const categories: Record<string, number> = {};

  for (const tool of resolvedTools) {
    if (planMode && !isPlanModeAllowed(tool.name)) {
      inactiveReason[tool.name] = 'plan_mode_blocked';
      continue;
    }
    const creds = await credentialStatusForTool(tool.name);
    const risk = toolRiskTier(tool.name, tool);
    active.push({
      name: tool.name,
      description: catalogDescription(tool),
      category: categorizeTool(tool.name),
      credentialRequired: creds.credentialRequired,
      credentialStatus: creds.credentialStatus,
      riskClass: risk === 'critical' || risk === 'high' ? 'destructive' : tool.dangerous ? 'dangerous' : 'safe',
      requiresConfirmation: Boolean(tool.dangerous || tool.requiresConfirmation),
    });
    categories[categorizeTool(tool.name)] = (categories[categorizeTool(tool.name)] ?? 0) + 1;
    if (creds.credentialStatus === 'missing') {
      inactiveReason[tool.name] = 'credential_missing';
    }
  }

  if (embeddingFiltered) {
    for (const tool of allTools) {
      if (!activeNames.has(tool.name)) {
        inactiveReason[tool.name] = 'embedding_filtered';
      }
    }
  }

  if (planMode) {
    for (const tool of allTools) {
      if (!activeNames.has(tool.name) && !inactiveReason[tool.name]) {
        inactiveReason[tool.name] = 'plan_mode_blocked';
      }
    }
  }

  return { active, inactiveReason, categories };
}

export async function buildCapabilityManifest(
  opts: BuildCapabilityManifestOpts,
): Promise<CapabilityManifest> {
  const workspaceId = opts.workspaceId?.trim() || null;
  const cacheKey = `${opts.sessionId}:${workspaceId ?? ''}:${opts.platform ?? ''}`;
  const cached = manifestCache.get(cacheKey);
  if (!opts.forceRefresh && cached && cached.expiresAt > Date.now()) {
    return cached.manifest;
  }

  const resolution = await resolveSessionTools({
    sessionId: opts.sessionId,
    platform: opts.platform,
    explicitAllowed: opts.explicitAllowed,
    userMessage: opts.userMessage,
    provider: opts.provider,
    model: opts.model,
  });

  const base = emptyManifest(opts.sessionId, workspaceId);
  const tools = await buildToolsSection(opts.sessionId, resolution.tools, Boolean(resolution.embeddingFiltered));
  let channels = gatewayChannels();
  if (workspaceId) {
    const workerChannels = await workspaceWorkerChannels(workspaceId);
    if (workerChannels.length > 0) {
      channels = {
        connected: workerChannels.filter((c) => c.connected),
        available: workerChannels.filter((c) => !c.connected),
      };
    }
  }

  const skills = activeSkillsFromPacks();
  const extensions = await getActiveExtensions(workspaceId);
  const rag = await getWorkspaceRagStatus(workspaceId);
  const credentials = await getAggregateCredentialStatus();
  const platform = await resolvePlatformTier(workspaceId);
  const scout = await resolveScoutBlock(workspaceId);
  const allTools = registry.list();

  const manifest: CapabilityManifest = {
    ...base,
    generatedAt: new Date().toISOString(),
    summary: {
      totalToolsActive: tools.active.length,
      totalToolsAvailable: allTools.length,
      totalSkillsActive: skills.length,
      totalChannelsConnected: channels.connected.length,
      totalExtensionsActive: extensions.length,
      totalRagDocuments: rag.documentCount,
      ragDomains: rag.domains,
    },
    tools,
    channels,
    skills: {
      active: skills,
      categories: groupByCategory(skills),
    },
    extensions: {
      active: extensions.map((e) => ({
        name: e.name,
        description: e.description,
        providesCapabilities: e.capabilities,
      })),
    },
    knowledge: {
      documentCount: rag.documentCount,
      domains: rag.domains,
      totalTokens: rag.totalTokens,
      lastUpdated: rag.lastUpdated,
    },
    credentials,
    platform,
    scout,
  };

  manifestCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, manifest });
  return manifest;
}

/** @deprecated Use buildCapabilityManifest */
export async function buildSessionCapabilityManifest(
  sessionId: string,
  options: { workspaceId?: string | null; forceRefresh?: boolean } = {},
): Promise<CapabilityManifest> {
  return buildCapabilityManifest({
    sessionId,
    workspaceId: options.workspaceId,
    forceRefresh: options.forceRefresh,
  });
}

export function findBestToolMatch(
  query: string,
  manifest: CapabilityManifest,
): ToolCapabilityEntry | null {
  const needle = query.trim().toLowerCase();
  if (!needle) return null;
  const exact = manifest.tools.active.find((row) => row.name.toLowerCase() === needle);
  if (exact) return exact;
  return manifest.tools.active.find(
    (row) =>
      row.name.toLowerCase().includes(needle)
      || row.description.toLowerCase().includes(needle),
  ) ?? null;
}

export function clearManifestCacheForTests(): void {
  manifestCache.clear();
}
