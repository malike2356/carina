import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import {
  activateProfile,
  applyActiveProfileFromDisk,
  describeProfile,
  type CarinaProfile,
} from '../../profiles/manager.js';
import { loadCarinaEnv } from '../../config/load-env.js';

export interface McpProfileContext {
  profileName: string;
  profile: CarinaProfile | null;
  toolsetsPath: string;
}

export function bindMcpProfile(profileName?: string): McpProfileContext {
  loadCarinaEnv();

  let profile: CarinaProfile | null = null;
  if (profileName) {
    profile = activateProfile(profileName);
  } else {
    profile = applyActiveProfileFromDisk();
  }

  if (profile) {
    if (fs.existsSync(profile.envPath)) {
      dotenv.config({ path: profile.envPath, override: true });
    }
    process.env.CARINA_PROFILE = profile.name;
    process.env.CARINA_HOME = profile.dir;
    process.env.CARINA_RESOURCES_DIR = path.join(profile.dir, 'resources');
    process.env.CARINA_TOOLSETS_FILE = path.join(profile.dir, 'toolsets.yaml');
    return {
      profileName: profile.name,
      profile,
      toolsetsPath: process.env.CARINA_TOOLSETS_FILE,
    };
  }

  const fallback = describeProfile('default');
  return {
    profileName: 'default',
    profile: null,
    toolsetsPath: process.env.CARINA_TOOLSETS_FILE
      ?? path.join(process.env.CARINA_HOME ?? fallback.dir, 'toolsets.yaml'),
  };
}
