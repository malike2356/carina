import path from 'node:path';

export const EXTENSION_ALLOWED_ROOT = 'src/tools/dynamic/extensions/';

export const EXTENSION_FORBIDDEN_PATHS = [
  'src/brain/',
  'src/security/',
  'src/memory/',
  'src/auth/',
  'src/api/',
  'src/server.ts',
  'src/agents/tool-runner.ts',
  'src/tools/dynamic/generate-and-run.ts',
  'src/tools/dynamic/auth-gate.ts',
  'src/tools/dynamic/persist-tool.ts',
  'src/tools/dynamic/approve-tool.ts',
] as const;

export function validateExtensionPath(filePath: string): { valid: boolean; reason?: string } {
  const normalized = path.posix.normalize(filePath.replace(/\\/g, '/'));

  if (!normalized.startsWith(EXTENSION_ALLOWED_ROOT)) {
    return {
      valid: false,
      reason: `File "${filePath}" is outside the allowed root "${EXTENSION_ALLOWED_ROOT}"`,
    };
  }
  for (const forbidden of EXTENSION_FORBIDDEN_PATHS) {
    if (normalized.startsWith(forbidden)) {
      return {
        valid: false,
        reason: `File "${filePath}" is in a forbidden path "${forbidden}"`,
      };
    }
  }
  return { valid: true };
}

export function validateAllPaths(filePaths: string[]): { valid: boolean; violations: string[] } {
  const violations: string[] = [];
  for (const p of filePaths) {
    const result = validateExtensionPath(p);
    if (!result.valid && result.reason) violations.push(result.reason);
  }
  return { valid: violations.length === 0, violations };
}
