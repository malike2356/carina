import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { globalCarinaHome } from '../config/paths.js';
import { describeProfile, profilesRootPath, type CarinaProfile } from './manager.js';

export interface ProfileScopeInfo {
  profile: string;
  active: boolean;
  scoped: {
    carinaHome: string;
    config: string;
    env: string;
    data: string;
    toolsets: string;
    credentials: string;
    checkpoints: string;
    resources: string;
    personalityMd: string;
    personalityYaml: string;
  };
  global: {
    profilesRoot: string;
    activeProfileFile: string;
    globalEnv: string;
  };
  runtime: {
    provider: string;
    activeSkillPacks: string;
    memoryBackend: string;
  };
}

export function bindProfileEnvironment(profile: CarinaProfile): void {
  if (fs.existsSync(profile.envPath)) {
    dotenv.config({ path: profile.envPath, override: true });
  }
  process.env.CARINA_PROFILE = profile.name;
  process.env.CARINA_HOME = profile.dir;
  process.env.CARINA_RESOURCES_DIR = path.join(profile.dir, 'resources');
  process.env.CARINA_TOOLSETS_FILE = path.join(profile.dir, 'toolsets.yaml');
  process.env.CARINA_CREDENTIALS_FILE = path.join(profile.dir, 'credentials.json');
}

export function applyProfileProviderFromConfig(profile: CarinaProfile): string | null {
  if (!fs.existsSync(profile.configPath)) return null;
  try {
    const raw = fs.readFileSync(profile.configPath, 'utf8');
    const match = raw.match(/^provider:\s*(\S+)/m);
    if (!match) return null;
    const provider = match[1]!.trim();
    process.env.DEFAULT_PROVIDER = provider;
    return provider;
  } catch {
    return null;
  }
}

export function describeProfileScope(
  profile: CarinaProfile,
  activeName: string | null,
): ProfileScopeInfo {
  return {
    profile: profile.name,
    active: activeName === profile.name,
    scoped: {
      carinaHome: profile.dir,
      config: profile.configPath,
      env: profile.envPath,
      data: profile.dataDir,
      toolsets: path.join(profile.dir, 'toolsets.yaml'),
      credentials: path.join(profile.dir, 'credentials.json'),
      checkpoints: path.join(profile.dataDir, 'checkpoints'),
      resources: path.join(profile.dir, 'resources'),
      personalityMd: path.join(profile.dir, 'personality.md'),
      personalityYaml: path.join(profile.dir, 'personality.yaml'),
    },
    global: {
      profilesRoot: profilesRootPath(),
      activeProfileFile: path.join(globalCarinaHome(), 'active-profile'),
      globalEnv: path.join(globalCarinaHome(), '.env'),
    },
    runtime: {
      provider: process.env.DEFAULT_PROVIDER ?? '',
      activeSkillPacks: process.env.ACTIVE_SKILL_PACKS ?? process.env.ACTIVE_SKILL_PACK ?? '',
      memoryBackend: process.env.CARINA_MEMORY_BACKEND ?? 'builtin',
    },
  };
}

export function describeNamedProfileScope(name: string, activeName: string | null): ProfileScopeInfo {
  return describeProfileScope(describeProfile(name), activeName);
}
