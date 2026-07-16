import { config } from '../config/index.js';
import { resolveEdgeTtsBin } from '../utils/tts.js';
import { isImageGenerationConfigured } from '../gateway/images-provider.js';

export type CarinaSurface =
  | 'cli'
  | 'tui'
  | 'web-private'
  | 'web-hosted'
  | 'cloud-byok'
  | 'cloud-core-proxy'
  | 'telegram'
  | 'mobile'
  | 'desktop';

export interface SurfaceCapabilityItem {
  id: string;
  label: string;
  available: boolean;
  reason?: string;
}

export interface SurfaceCapabilityContract {
  surface: CarinaSurface;
  identityLine: string;
  capabilities: SurfaceCapabilityItem[];
  summaryLine: string;
}

export interface SurfaceRuntimeSnapshot {
  memoryEnabled: boolean;
  memoryBackend: 'postgres' | 'sqlite' | 'none';
  webSearchEnabled: boolean;
  agentToolsEnabled: boolean;
  voiceRepliesEnabled: boolean;
  scoutEnabled: boolean;
  activeSkillPacks: string[];
  configuredChannels: string[];
  ttsAvailable: boolean;
  imageGenerationAvailable: boolean;
}

const DEFAULT_IDENTITY =
  'I am Carina, an autonomous agent built by VERLOX. I remember context, search the web, and use tools when this surface allows.';

function memoryBackendFromEnv(): 'postgres' | 'sqlite' | 'none' {
  const url = process.env.DATABASE_URL ?? process.env.CARINA_DB_URL ?? '';
  if (url.startsWith('postgres')) return 'postgres';
  if (url.includes('sqlite')) return 'sqlite';
  return 'none';
}

export function collectSurfaceRuntimeSnapshot(): SurfaceRuntimeSnapshot {
  const memoryBackend = memoryBackendFromEnv();
  const ttsAvailable = Boolean(
    process.env.OPENAI_API_KEY?.trim()
    || process.env.EDGE_TTS_BIN?.trim()
    || resolveEdgeTtsBin(),
  );
  const webSearchEnabled = Boolean(
    process.env.TAVILY_API_KEY?.trim()
    || config.tavily?.apiKey?.trim(),
  );
  const scoutEnabled =
    process.env.LABYRINTH_ENABLED === 'true' || process.env.SCOUT_ENABLED === 'true';
  const activeSkillPacks = config.carina.activePacks;
  const configuredChannels = (process.env.CARINA_CHANNELS ?? '')
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);

  return {
    memoryEnabled: memoryBackend !== 'none',
    memoryBackend,
    webSearchEnabled,
    agentToolsEnabled: true,
    voiceRepliesEnabled: ttsAvailable,
    scoutEnabled,
    activeSkillPacks,
    configuredChannels,
    ttsAvailable,
    imageGenerationAvailable: isImageGenerationConfigured(),
  };
}

export function resolveSurface(input: {
  platform?: string;
  hostedMode?: boolean;
  coreProxy?: boolean;
}): CarinaSurface {
  const platform = (input.platform ?? '').toLowerCase();
  if (platform === 'telegram') return 'telegram';
  if (platform === 'mobile') return 'mobile';
  if (platform === 'desktop') return 'desktop';
  if (platform === 'tui') return 'tui';
  if (platform === 'cli') return 'cli';

  if (input.coreProxy) return 'cloud-core-proxy';
  if (input.hostedMode === false && platform === 'web') return 'web-private';
  if (input.hostedMode === true && platform === 'web') return 'web-hosted';
  if (process.env.CARINA_USE_CORE_PROXY === 'true') return 'cloud-core-proxy';
  if (process.env.HOSTED_MODE === 'true') return 'web-hosted';
  if (platform === 'web') return 'web-private';
  return 'cli';
}

type CapabilityDef = { id: string; label: string; surfaces: CarinaSurface[]; webOnly?: boolean };

const BASE_CAPABILITIES: CapabilityDef[] = [
  { id: 'chat', label: 'Chat', surfaces: ['cli', 'tui', 'web-private', 'web-hosted', 'cloud-byok', 'cloud-core-proxy', 'telegram', 'mobile', 'desktop'] },
  { id: 'web-search', label: 'Web search', surfaces: ['cli', 'tui', 'web-private', 'web-hosted', 'cloud-core-proxy', 'telegram', 'mobile', 'desktop'] },
  { id: 'memory', label: 'Persistent memory', surfaces: ['cli', 'tui', 'web-private', 'web-hosted', 'cloud-byok', 'cloud-core-proxy', 'mobile', 'desktop'] },
  { id: 'voice', label: 'Voice replies', surfaces: ['cli', 'tui', 'web-private', 'web-hosted', 'telegram', 'mobile', 'desktop'] },
  { id: 'images', label: 'Images', surfaces: ['cli', 'tui', 'web-private', 'web-hosted', 'cloud-core-proxy', 'telegram', 'mobile', 'desktop'] },
  { id: 'tools', label: 'Agent tools', surfaces: ['cli', 'tui', 'web-private', 'web-hosted', 'cloud-byok', 'cloud-core-proxy', 'mobile', 'desktop'] },
  { id: 'scheduled', label: 'Scheduled jobs', surfaces: ['cli', 'tui', 'web-private', 'web-hosted', 'cloud-core-proxy'], webOnly: true },
  { id: 'documents', label: 'Documents editor', surfaces: ['web-private', 'web-hosted', 'cloud-core-proxy'], webOnly: true },
  { id: 'email', label: 'Email', surfaces: ['web-private', 'web-hosted'], webOnly: true },
  { id: 'calendar', label: 'Calendar', surfaces: ['web-private', 'web-hosted'], webOnly: true },
  { id: 'trello', label: 'Trello', surfaces: ['web-private', 'web-hosted'], webOnly: true },
  { id: 'skills', label: 'Custom skill hints', surfaces: ['cloud-byok', 'cloud-core-proxy', 'web-hosted'] },
];

function identityForSurface(surface: CarinaSurface, runtime: SurfaceRuntimeSnapshot): string {
  if (surface === 'cloud-byok') {
    return 'I am Carina Cloud. This workspace runs chat on your API keys; advanced tools need core proxy.';
  }
  if (surface === 'cloud-core-proxy') {
    return 'I am Carina Cloud. This workspace uses the hosted core for chat, search, and tools where enabled.';
  }
  let line = DEFAULT_IDENTITY;
  if (runtime.activeSkillPacks.includes('property-uk')) {
    line += ' Property-uk skills are enabled for this install.';
  }
  return line;
}

function runtimeGate(
  id: string,
  surface: CarinaSurface,
  runtime: SurfaceRuntimeSnapshot,
): { available: boolean; reason?: string } {
  switch (id) {
    case 'web-search':
      if (!runtime.webSearchEnabled) {
        return { available: false, reason: 'Web search is not configured on this install.' };
      }
      if (surface === 'cloud-byok') {
        return { available: false, reason: 'Web search needs core proxy on Carina Cloud.' };
      }
      return { available: true };
    case 'memory':
      return runtime.memoryEnabled
        ? { available: true }
        : { available: false, reason: 'Memory backend is not configured.' };
    case 'voice':
      return runtime.ttsAvailable
        ? { available: true }
        : { available: false, reason: 'Text-to-speech is not configured.' };
    case 'images':
      if (!runtime.imageGenerationAvailable) {
        return { available: false, reason: 'Image generation needs OPENAI_API_KEY and the media toolset.' };
      }
      if (surface === 'cloud-byok') {
        return { available: false, reason: 'Image generation needs core proxy on Carina Cloud.' };
      }
      return { available: true };
    case 'tools':
      if (surface === 'cloud-byok') {
        return { available: false, reason: 'Tool execution needs core proxy on Carina Cloud.' };
      }
      if (surface === 'telegram') {
        return runtime.agentToolsEnabled
          ? { available: true }
          : { available: false, reason: 'No tools are available for this session.' };
      }
      return runtime.agentToolsEnabled
        ? { available: true }
        : { available: false, reason: 'Agent tools are not enabled.' };
    case 'scheduled':
    case 'documents':
    case 'email':
    case 'calendar':
    case 'trello':
      if (surface === 'telegram' || surface === 'mobile') {
        return { available: false, reason: 'Open the web workspace for this feature.' };
      }
      return { available: true };
    default:
      return { available: true };
  }
}

export function buildSurfaceContract(
  surface: CarinaSurface,
  runtime: SurfaceRuntimeSnapshot = collectSurfaceRuntimeSnapshot(),
): SurfaceCapabilityContract {
  const capabilities: SurfaceCapabilityItem[] = BASE_CAPABILITIES
    .filter((def) => def.surfaces.includes(surface))
    .map((def) => {
      const gate = runtimeGate(def.id, surface, runtime);
      return {
        id: def.id,
        label: def.label,
        available: gate.available,
        reason: gate.reason,
      };
    });

  const availableLabels = capabilities.filter((c) => c.available).map((c) => c.label);
  const summaryLine = availableLabels.length
    ? `${availableLabels.join(', ')}. Ask me how to use any of them and I will walk you through it.`
    : 'Chat is available. Ask what you need and I will explain what this surface supports.';

  return {
    surface,
    identityLine: identityForSurface(surface, runtime),
    capabilities,
    summaryLine,
  };
}

export function buildCapabilitySummaryForSurface(
  surface: CarinaSurface,
  runtime?: SurfaceRuntimeSnapshot,
): string {
  return buildSurfaceContract(surface, runtime ?? collectSurfaceRuntimeSnapshot()).summaryLine;
}
