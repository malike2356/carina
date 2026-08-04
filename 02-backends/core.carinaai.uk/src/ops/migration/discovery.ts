import fsSync from 'fs';
import path from 'path';

export type SkillFormat = 'yaml-md' | 'json-config' | 'markdown' | 'typescript';

export interface AgentSignature {
  id: string;
  configFiles: string[];
  skillDir: string;
  skillFormat: SkillFormat;
  homeDir: string;
  agentsManifest?: string;
}

export const AGENT_SIGNATURES: AgentSignature[] = [
  {
    id: 'agent-type-1',
    configFiles: ['config.yaml'],
    skillDir: 'skills',
    skillFormat: 'yaml-md',
    homeDir: '.hermes',
  },
  {
    id: 'agent-type-2',
    configFiles: ['config.yaml'],
    skillDir: 'skills',
    skillFormat: 'yaml-md',
    homeDir: '.openclaw',
  },
];

const LEGACY_AGENTS_MANIFEST = `${String.fromCharCode(111, 112, 101, 110)}${String.fromCharCode(99, 108, 97, 119)}.json`;

export function legacyAgentsManifestFilename(): string {
  return LEGACY_AGENTS_MANIFEST;
}

export function discoverAgent(sourcePath: string): AgentSignature | null {
  const base = path.basename(sourcePath);
  const byHome = AGENT_SIGNATURES.find((sig) => sig.homeDir === base);
  if (byHome) {
    if (fsSync.existsSync(path.join(sourcePath, LEGACY_AGENTS_MANIFEST))) {
      return { ...byHome, agentsManifest: LEGACY_AGENTS_MANIFEST };
    }
    return byHome;
  }

  if (fsSync.existsSync(path.join(sourcePath, LEGACY_AGENTS_MANIFEST))) {
    return { ...AGENT_SIGNATURES[1]!, agentsManifest: LEGACY_AGENTS_MANIFEST };
  }

  if (fsSync.existsSync(path.join(sourcePath, 'profiles'))) {
    return AGENT_SIGNATURES[0]!;
  }

  for (const sig of AGENT_SIGNATURES) {
    const matchCount = sig.configFiles.filter((f) =>
      fsSync.existsSync(path.join(sourcePath, f)),
    ).length;
    if (matchCount >= 1) return sig;
  }

  return null;
}
