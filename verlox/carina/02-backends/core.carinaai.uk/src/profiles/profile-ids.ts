/** Built-in Carina profiles shipped with the kernel. */
export const BUILTIN_PROFILE_IDS = {
  support: 'support',
} as const;

export type BuiltinProfileId = (typeof BUILTIN_PROFILE_IDS)[keyof typeof BUILTIN_PROFILE_IDS];

export function isBuiltinProfileId(profileName: string): profileName is BuiltinProfileId {
  return Object.values(BUILTIN_PROFILE_IDS).includes(profileName as BuiltinProfileId);
}

export function profileSessionPrefix(profileName: string): string {
  return `profile:${profileName}:`;
}

export function profileOperatorSessionId(profileName: string): string {
  return `op:${profileName}`;
}
