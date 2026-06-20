export interface SequenceStep {
  toolName: string;
  params: Record<string, unknown>;
  timestamp: number;
}

export interface SequenceViolation {
  ruleId: string;
  label: string;
  severity: 'critical' | 'warning';
  sequence: string[];
}

export class ToolSequenceBlockedError extends Error {
  readonly code = 'TOOL_SEQUENCE_BLOCKED';
  readonly ruleId: string;

  constructor(violation: SequenceViolation) {
    super(`Blocked suspicious tool sequence (${violation.ruleId}): ${violation.label}`);
    this.name = 'ToolSequenceBlockedError';
    this.ruleId = violation.ruleId;
  }
}

const SENSITIVE_PATH_RE = /(\.env|credentials?|secret|\.ssh|id_rsa|token|api[_-]?key)/i;
const EXFIL_COMMAND_RE = /(curl|wget|nc\s|netcat|scp|rsync|base64\s+-d)/i;
const CONFIG_WRITE_RE = /(config|\.json|\.ya?ml|settings|policy)/i;
const PRIV_ESCALATION_RE = /(chmod|chown|sudo|usermod|setcap|crontab)/i;

const MAX_STEPS = 32;

export function detectSequenceViolation(
  history: SequenceStep[],
  nextTool: string,
  nextParams: Record<string, unknown>,
): SequenceViolation | null {
  const steps = [...history, { toolName: nextTool, params: nextParams, timestamp: Date.now() }];
  const names = steps.map((s) => s.toolName);

  if (detectCredentialExfil(steps)) {
    return {
      ruleId: 'SEQ-001',
      label: 'Credential file read followed by network exfiltration attempt',
      severity: 'critical',
      sequence: names,
    };
  }

  if (detectConfigPrivilegeEscalation(steps)) {
    return {
      ruleId: 'SEQ-005',
      label: 'Config write followed by privilege escalation command',
      severity: 'critical',
      sequence: names,
    };
  }

  if (detectSensitiveReadThenEmail(steps)) {
    return {
      ruleId: 'SEQ-002',
      label: 'Sensitive file read followed by outbound email',
      severity: 'warning',
      sequence: names,
    };
  }

  if (detectRapidExfilBurst(steps)) {
    return {
      ruleId: 'SEQ-003',
      label: 'Rapid file-read and outbound network burst in short window',
      severity: 'warning',
      sequence: names,
    };
  }

  return null;
}

function detectCredentialExfil(steps: SequenceStep[]): boolean {
  const recent = steps.slice(-6);
  let sawSensitiveRead = false;

  for (const step of recent) {
    if (step.toolName === 'file-read' && pathFromParams(step.params) && SENSITIVE_PATH_RE.test(pathFromParams(step.params)!)) {
      sawSensitiveRead = true;
      continue;
    }
    if (!sawSensitiveRead) continue;

    if (step.toolName === 'http-request') return true;
    if (step.toolName === 'shell-exec' && commandFromParams(step.params) && EXFIL_COMMAND_RE.test(commandFromParams(step.params)!)) {
      return true;
    }
  }

  return false;
}

function detectConfigPrivilegeEscalation(steps: SequenceStep[]): boolean {
  const recent = steps.slice(-5);
  let sawConfigWrite = false;

  for (const step of recent) {
    if (step.toolName === 'file-write' && pathFromParams(step.params) && CONFIG_WRITE_RE.test(pathFromParams(step.params)!)) {
      sawConfigWrite = true;
      continue;
    }
    if (!sawConfigWrite || step.toolName !== 'shell-exec') continue;
    const cmd = commandFromParams(step.params);
    if (cmd && PRIV_ESCALATION_RE.test(cmd)) return true;
  }

  return false;
}

function detectSensitiveReadThenEmail(steps: SequenceStep[]): boolean {
  const recent = steps.slice(-4);
  let sawSensitiveRead = false;

  for (const step of recent) {
    if (step.toolName === 'file-read' && pathFromParams(step.params) && SENSITIVE_PATH_RE.test(pathFromParams(step.params)!)) {
      sawSensitiveRead = true;
      continue;
    }
    if (sawSensitiveRead && step.toolName === 'email-send') return true;
  }

  return false;
}

function detectRapidExfilBurst(steps: SequenceStep[]): boolean {
  const windowMs = 60_000;
  const now = steps[steps.length - 1]?.timestamp ?? Date.now();
  const recent = steps.filter((s) => now - s.timestamp <= windowMs);
  const fileReads = recent.filter((s) => s.toolName === 'file-read').length;
  const outbound = recent.filter((s) => s.toolName === 'http-request' || s.toolName === 'email-send').length;
  return fileReads >= 3 && outbound >= 2;
}

function pathFromParams(params: Record<string, unknown>): string | null {
  const path = params.path ?? params.file ?? params.filepath;
  return typeof path === 'string' ? path : null;
}

function commandFromParams(params: Record<string, unknown>): string | null {
  return typeof params.command === 'string' ? params.command : null;
}

export class ToolSequenceTracker {
  private readonly sessions = new Map<string, SequenceStep[]>();

  record(sessionId: string, toolName: string, params: Record<string, unknown>): void {
    const list = this.sessions.get(sessionId) ?? [];
    list.push({ toolName, params, timestamp: Date.now() });
    if (list.length > MAX_STEPS) list.shift();
    this.sessions.set(sessionId, list);
  }

  check(sessionId: string, toolName: string, params: Record<string, unknown>): SequenceViolation | null {
    const history = this.sessions.get(sessionId) ?? [];
    return detectSequenceViolation(history, toolName, params);
  }

  clear(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  getSequence(sessionId: string): string[] {
    return (this.sessions.get(sessionId) ?? []).map((s) => s.toolName);
  }

  /** Reset singleton state (tests only). */
  reset(): void {
    this.sessions.clear();
  }
}

let tracker: ToolSequenceTracker | null = null;

export function getToolSequenceTracker(): ToolSequenceTracker {
  if (!tracker) tracker = new ToolSequenceTracker();
  return tracker;
}

export function _resetToolSequenceTracker(): void {
  tracker = null;
}

export function isToolSequenceGuardEnabled(): boolean {
  if (process.env.TOOL_SEQUENCE_GUARD_ENABLED === 'false') return false;
  return process.env.LABYRINTH_ENABLED === 'true' || process.env.TOOL_SEQUENCE_GUARD_ENABLED === 'true';
}
