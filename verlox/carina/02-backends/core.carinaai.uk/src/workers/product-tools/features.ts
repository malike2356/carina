import { readFileSync, existsSync } from 'node:fs';
import { resolveAivaConfigFile } from './config-path.js';

export type AivaDepthFeatures = {
  version: number;
  voice: {
    mode: 'ptt' | 'duplex';
    duplexProvider: string;
    allowPttFallback: boolean;
    bargeIn: boolean;
    preferServerTts: boolean;
  };
  skills: {
    autoPropose: boolean;
    requireConfirm: boolean;
    bindToolsStrict: boolean;
    conversationalSave?: boolean;
    savePhrases?: string[];
  };
  tools?: {
    accountsEnabled?: boolean;
  };
  orgs: {
    enabled: boolean;
    workersAsManagers: boolean;
    canvasEnabled: boolean;
    switcherEnabled?: boolean;
    strictScoping?: boolean;
  };
  browser: {
    softHttpEnabled: boolean;
    playwrightEnabled: boolean;
    captchaMode: 'disabled' | 'owner_assist' | 'provider';
    captchaProvider?: string;
    domainAllowlist: string[];
    domainAllowlistEnforce: boolean;
  };
  search: {
    messageBody: boolean;
    useFullText: boolean;
  };
  projects: {
    autoLinkSkillRuns: boolean;
    autoAdvanceStatus: boolean;
  };
  composer: {
    draftPersistence: boolean;
    maxChars: number;
  };
};

let cached: AivaDepthFeatures | null = null;
let cachedPath: string | null = null;

export function resolveDepthFeaturesPath(): string {
  return resolveAivaConfigFile(
    process.env.AIVA_DEPTH_FEATURES_PATH,
    'depth-features.json',
    import.meta.url,
  );
}

export function loadDepthFeatures(force = false): AivaDepthFeatures {
  const featuresPath = resolveDepthFeaturesPath();
  if (!force && cached && cachedPath === featuresPath) return cached;
  if (!existsSync(featuresPath)) {
    throw new Error(`Aiva depth features config not found at ${featuresPath}`);
  }
  cached = JSON.parse(readFileSync(featuresPath, 'utf8')) as AivaDepthFeatures;
  cachedPath = featuresPath;
  return cached;
}

export function reloadDepthFeatures(): AivaDepthFeatures {
  return loadDepthFeatures(true);
}
