export type ExecApprovalLevel = 'off' | 'on-miss' | 'full';

export function resolveExecApprovalLevel(): ExecApprovalLevel {
  const raw = (process.env.CARINA_EXEC_APPROVAL_LEVEL ?? 'on-miss').trim().toLowerCase();
  if (raw === 'off' || raw === 'false' || raw === '0') return 'off';
  if (raw === 'full' || raw === 'always' || raw === 'all') return 'full';
  return 'on-miss';
}

/** Whether shell-exec requires interactive approval at the current exec level. */
export function shellExecRequiresApproval(command: string, dangerousPatternMatched: boolean): boolean {
  const level = resolveExecApprovalLevel();
  if (level === 'off') return false;
  if (level === 'full') return true;
  return dangerousPatternMatched;
}

export function describeExecApprovalLevel(level = resolveExecApprovalLevel()): string {
  switch (level) {
    case 'off':
      return 'Exec approval off; shell-exec uses standard tool confirmation only.';
    case 'full':
      return 'Exec approval full; every shell-exec command requires interactive approval.';
    default:
      return 'Exec approval on-miss; shell-exec requires approval when dangerous patterns match.';
  }
}
