import fs from 'fs';
import path from 'path';
import {
  activateProfile,
  applyActiveProfileFromDisk,
  getActiveProfileName,
  type CarinaProfile,
} from '../profiles/manager.js';
import { bindProfileEnvironment } from '../profiles/scope.js';
import { loadCarinaEnv } from '../config/load-env.js';
import { CARINA_HOME } from '../config/paths.js';

export interface OperatorProfileContext {
  profileName: string;
  profile: CarinaProfile | null;
  sessionScope: string;
  credentialsPath: string;
  reportsDir: string;
}

export function operatorSessionId(profileName: string): string {
  return `op:${profileName}`;
}

export function bindOperatorProfile(profileArg?: string): OperatorProfileContext {
  loadCarinaEnv();

  let profile: CarinaProfile | null = null;
  if (profileArg) {
    profile = activateProfile(profileArg);
  } else {
    profile = applyActiveProfileFromDisk();
  }

  const profileName = profile?.name ?? getActiveProfileName() ?? 'default';
  const baseDir = profile?.dir ?? CARINA_HOME;

  if (profile) {
    bindProfileEnvironment(profile);
  } else {
    process.env.CARINA_CREDENTIALS_FILE = path.join(baseDir, 'credentials.json');
  }

  const credentialsPath = process.env.CARINA_CREDENTIALS_FILE
    ?? path.join(baseDir, 'credentials.json');

  const reportsDir = path.join(baseDir, 'data', 'curator-reports');
  fs.mkdirSync(reportsDir, { recursive: true });

  return {
    profileName,
    profile,
    sessionScope: operatorSessionId(profileName),
    credentialsPath,
    reportsDir,
  };
}
