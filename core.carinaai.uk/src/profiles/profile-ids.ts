export function profileSessionPrefix(profileName: string): string {
  return `profile:${profileName}:`;
}

export function profileOperatorSessionId(profileName: string): string {
  return `op:${profileName}`;
}
