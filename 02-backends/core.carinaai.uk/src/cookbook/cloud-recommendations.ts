import { isProviderConfigured, PROVIDER_MAP, providerModel } from '../brain/provider-registry.js';
import type { CatalogEntry, HardwareProfile, HardwareTier } from './types.js';
import { recommendModels } from './recommender.js';

export type RecommendationScenario =
  | 'local-only'
  | 'low-vram'
  | 'cloud-only'
  | 'mixed'
  | 'no-suitable';

export interface CloudModelRecommendation {
  providerId: string;
  providerName: string;
  model: string;
  configured: boolean;
  strengths: string[];
  contextWindow: number;
  note: string;
}

export interface FullStackRecommendation {
  scenario: RecommendationScenario;
  tier: HardwareTier;
  local: CatalogEntry[];
  cloud: CloudModelRecommendation[];
  gapFillers: CloudModelRecommendation[];
  message: string;
}

const CLOUD_CATALOG: Array<{
  providerId: string;
  strengths: string[];
  contextWindow: number;
  note: string;
  minTier?: HardwareTier[];
}> = [
  {
    providerId: 'deepseek',
    strengths: ['coding', 'instruction', 'reasoning', 'cost-effective'],
    contextWindow: 128_000,
    note: 'Strong default for agent workloads; low cost per token.',
  },
  {
    providerId: 'anthropic',
    strengths: ['instruction', 'reasoning', 'long-context'],
    contextWindow: 200_000,
    note: 'High quality synthesis and careful reasoning.',
  },
  {
    providerId: 'openai',
    strengths: ['instruction', 'multimodal', 'tool-use'],
    contextWindow: 128_000,
    note: 'Broad capability; good when you need GPT-family behavior.',
  },
  {
    providerId: 'gemini',
    strengths: ['long-context', 'multimodal', 'fast'],
    contextWindow: 1_000_000,
    note: 'Very large context window for document-heavy tasks.',
  },
  {
    providerId: 'groq',
    strengths: ['fast', 'instruction', 'low-latency'],
    contextWindow: 32_768,
    note: 'Fast inference when latency matters more than local VRAM.',
  },
  {
    providerId: 'ollama',
    strengths: ['local', 'privacy', 'offline'],
    contextWindow: 32_768,
    note: 'Local inference when Ollama is already running.',
  },
];

function cloudEntry(row: typeof CLOUD_CATALOG[number]): CloudModelRecommendation | null {
  const def = PROVIDER_MAP[row.providerId];
  if (!def || def.local) return null;
  return {
    providerId: def.name,
    providerName: def.displayName,
    model: providerModel(def),
    configured: isProviderConfigured(def),
    strengths: row.strengths,
    contextWindow: row.contextWindow,
    note: row.note,
  };
}

function resolveScenario(
  profile: HardwareProfile,
  localCount: number,
  configuredCloudCount: number,
): RecommendationScenario {
  const vram = profile.gpu?.vramGb ?? 0;
  if (localCount === 0 && configuredCloudCount === 0) return 'no-suitable';
  if (vram <= 0 && localCount === 0 && configuredCloudCount > 0) return 'cloud-only';
  if (vram > 0 && vram <= 6 && localCount > 0 && configuredCloudCount > 0) return 'low-vram';
  if (localCount > 0 && configuredCloudCount > 0) return 'mixed';
  if (localCount > 0) return 'local-only';
  if (configuredCloudCount > 0) return 'cloud-only';
  return 'no-suitable';
}

export function recommendCloudModels(limit = 5): CloudModelRecommendation[] {
  const entries = CLOUD_CATALOG
    .map(cloudEntry)
    .filter((e): e is CloudModelRecommendation => e !== null);

  const configured = entries.filter((e) => e.configured);
  const pool = configured.length > 0 ? configured : entries;
  return pool.slice(0, limit);
}

export function recommendFullStack(profile: HardwareProfile): FullStackRecommendation {
  const localRec = recommendModels(profile);
  const cloud = recommendCloudModels(5);
  const configuredCloud = cloud.filter((c) => c.configured);
  const scenario = resolveScenario(profile, localRec.recommended.length, configuredCloud.length);

  const gapFillers = scenario === 'low-vram' || scenario === 'no-suitable' || localRec.recommended.length < 3
    ? configuredCloud.length > 0
      ? configuredCloud.slice(0, 3)
      : cloud.slice(0, 3)
    : [];

  let message = '';
  switch (scenario) {
    case 'local-only':
      message = 'Your hardware can run local models. Cloud APIs are optional for heavier workloads.';
      break;
    case 'low-vram':
      message = 'VRAM is tight. Run small local quantizations or use configured cloud APIs for larger models.';
      break;
    case 'cloud-only':
      message = 'No suitable local models for this hardware. Use configured cloud APIs (set API keys in .env).';
      break;
    case 'mixed':
      message = 'Run capable local models on this machine and use cloud APIs to fill gaps (long context, larger models).';
      break;
    case 'no-suitable':
      message = 'No local models fit and no cloud providers are configured. Add API keys or free disk/RAM for local models.';
      break;
  }

  return {
    scenario,
    tier: localRec.tier,
    local: localRec.recommended,
    cloud,
    gapFillers,
    message,
  };
}
