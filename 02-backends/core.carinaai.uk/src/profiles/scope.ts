import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { globalCarinaHome } from '../config/paths.js';
import {
  profileOperatorSessionId,
  profileSessionPrefix,
} from './profile-ids.js';
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
    extensions: string;
    packs: string;
    runtimeMeta: string;
    personalityMd: string;
    personalityYaml: string;
  };
  global: {
    profilesRoot: string;
    activeProfileFile: string;
    globalEnv: string;
    switchStackFile: string;
  };
  runtime: {
    provider: string;
    activeSkillPacks: string;
    memoryBackend: string;
    operatorSession: string;
    sessionPrefix: string;
    cronProfile: string;
  };
}

export function bindProfileEnvironment(profile: CarinaProfile): void {
  if (fs.existsSync(profile.envPath)) {
    dotenv.config({ path: profile.envPath, override: true });
  }
  const home = profile.dir;
  process.env.CARINA_PROFILE = profile.name;
  process.env.CARINA_HOME = home;
  process.env.CARINA_DATA_DIR = path.join(home, 'data');
  process.env.CARINA_PACKS_DIR = path.join(home, 'packs');
  process.env.CARINA_EXTENSIONS_DIR = path.join(home, 'extensions');
  process.env.CARINA_RESOURCES_DIR = path.join(home, 'resources');
  process.env.CARINA_TOOLSETS_FILE = path.join(home, 'toolsets.yaml');
  process.env.CARINA_CREDENTIALS_FILE = path.join(home, 'credentials.json');
  process.env.CARINA_RUNTIME_META_FILE = path.join(home, 'data', 'runtime.json');
  process.env.CARINA_OPERATOR_SESSION_SCOPE = profileOperatorSessionId(profile.name);
  process.env.CARINA_PROFILE_SESSION_PREFIX = profileSessionPrefix(profile.name);
  applyProfileProviderFromConfig(profile);
  applyProfileSkillPacksFromConfig(profile);
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

export function applyProfileSkillPacksFromConfig(profile: CarinaProfile): string | null {
  if (!fs.existsSync(profile.configPath)) return null;
  try {
    const raw = fs.readFileSync(profile.configPath, 'utf8');
    const match = raw.match(/^activeSkillPacks:\s*(.+)$/m)
      ?? raw.match(/^active_skill_packs:\s*(.+)$/m);
    if (!match) return null;
    const packs = match[1]!.trim();
    if (packs) {
      process.env.ACTIVE_SKILL_PACKS = packs;
      return packs;
    }
    return null;
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
      extensions: path.join(profile.dir, 'extensions'),
      packs: path.join(profile.dir, 'packs'),
      runtimeMeta: path.join(profile.dataDir, 'runtime.json'),
      personalityMd: path.join(profile.dir, 'personality.md'),
      personalityYaml: path.join(profile.dir, 'personality.yaml'),
    },
    global: {
      profilesRoot: profilesRootPath(),
      activeProfileFile: path.join(globalCarinaHome(), 'active-profile'),
      globalEnv: path.join(globalCarinaHome(), '.env'),
      switchStackFile: path.join(globalCarinaHome(), 'profile-switch-stack.json'),
    },
    runtime: {
      provider: process.env.DEFAULT_PROVIDER ?? '',
      activeSkillPacks: process.env.ACTIVE_SKILL_PACKS ?? process.env.ACTIVE_SKILL_PACK ?? '',
      memoryBackend: process.env.CARINA_MEMORY_BACKEND ?? 'builtin',
      operatorSession: profileOperatorSessionId(profile.name),
      sessionPrefix: profileSessionPrefix(profile.name),
      cronProfile: profile.name,
    },
  };
}

export function describeNamedProfileScope(name: string, activeName: string | null): ProfileScopeInfo {
  return describeProfileScope(describeProfile(name), activeName);
}

export function formatProfileScopeBanner(profileName: string): string {
  const home = process.env.CARINA_HOME ?? '';
  const opSession = process.env.CARINA_OPERATOR_SESSION_SCOPE ?? `op:${profileName}`;
  const lines = [
    `Active profile: ${profileName}`,
    home ? `  CARINA_HOME=${home}` : '',
    `  operator session: ${opSession}`,
    `  memory scope: profile:${profileName}:* and ${opSession}*`,
  ].filter(Boolean);
  return lines.join('\n');
}
