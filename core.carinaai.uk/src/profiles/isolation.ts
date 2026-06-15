import fs from 'fs';
import path from 'path';
import { globalCarinaHome } from '../config/paths.js';
import { clearSessionSearchCacheForTests } from '../memory/session-index.js';
import { resetOperatorPackRuntime } from '../skills/operator-pack-store.js';
import {
  profileOperatorSessionId,
  profileSessionPrefix,
} from './profile-ids.js';
import {
  activateProfile,
  getActiveProfileName,
  type CarinaProfile,
} from './manager.js';

export type ProfileMemoryScope = {
  sql: string;
  params: unknown[];
};

export {
  profileOperatorSessionId,
  profileSessionPrefix,
} from './profile-ids.js';

function profileSwitchStackPath(): string {
  return path.join(globalCarinaHome(), 'profile-switch-stack.json');
}

type ProfileSwitchStack = { stack: string[] };

function readSwitchStack(): ProfileSwitchStack {
  try {
    const raw = fs.readFileSync(profileSwitchStackPath(), 'utf8');
    const parsed = JSON.parse(raw) as ProfileSwitchStack;
    return { stack: Array.isArray(parsed.stack) ? parsed.stack : [] };
  } catch {
    return { stack: [] };
  }
}

function writeSwitchStack(stack: ProfileSwitchStack): void {
  const file = profileSwitchStackPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(stack, null, 2), 'utf8');
}

export function getActiveProfileOrDefault(): string {
  return process.env.CARINA_PROFILE ?? getActiveProfileName() ?? 'default';
}

export function wrapSessionForProfile(profileName: string, sessionId: string): string {
  const prefix = profileSessionPrefix(profileName);
  if (sessionId.startsWith(prefix)) return sessionId;
  if (sessionId.startsWith('profile:')) return sessionId;
  return `${prefix}${sessionId}`;
}

export function operatorMemoryScope(profileName?: string): ProfileMemoryScope {
  const name = profileName ?? getActiveProfileOrDefault();
  const profilePrefix = `${profileSessionPrefix(name)}%`;
  const opExact = profileOperatorSessionId(name);
  const opPrefix = `${opExact}:%`;

  if (name === 'default') {
    return {
      sql: `(
        session_id LIKE $1 OR session_id = $2 OR session_id LIKE $3
        OR (
          session_id NOT LIKE 'profile:%'
          AND (session_id NOT LIKE 'op:%' OR session_id = $2 OR session_id LIKE $3)
        )
      )`,
      params: [profilePrefix, opExact, opPrefix],
    };
  }

  return {
    sql: `(session_id LIKE $1 OR session_id = $2 OR session_id LIKE $3)`,
    params: [profilePrefix, opExact, opPrefix],
  };
}

export function activeCronProfile(): string {
  return getActiveProfileOrDefault();
}

export function clearProfileRuntimeCaches(): void {
  resetOperatorPackRuntime();
  clearSessionSearchCacheForTests();
}

export function switchProfile(name: string): CarinaProfile {
  const current = getActiveProfileName();
  if (current && current !== name) {
    const stack = readSwitchStack();
    if (stack.stack[stack.stack.length - 1] !== current) {
      stack.stack.push(current);
    }
    writeSwitchStack(stack);
  }
  const profile = activateProfile(name);
  clearProfileRuntimeCaches();
  return profile;
}

export function switchProfileBack(): CarinaProfile | null {
  const stack = readSwitchStack();
  const previous = stack.stack.pop();
  if (!previous) return null;
  writeSwitchStack(stack);
  const profile = activateProfile(previous);
  clearProfileRuntimeCaches();
  return profile;
}

export function peekPreviousProfile(): string | null {
  const stack = readSwitchStack();
  return stack.stack[stack.stack.length - 1] ?? null;
}
