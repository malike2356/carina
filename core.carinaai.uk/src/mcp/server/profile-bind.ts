import path from 'path';
import {
  activateProfile,
  applyActiveProfileFromDisk,
  describeProfile,
  type CarinaProfile,
} from '../../profiles/manager.js';
import { bindProfileEnvironment } from '../../profiles/scope.js';
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
    bindProfileEnvironment(profile);
    return {
      profileName: profile.name,
      profile,
      toolsetsPath: process.env.CARINA_TOOLSETS_FILE!,
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
