export type ToolCardStatus = 'pending' | 'running' | 'success' | 'failed' | 'blocked' | 'cancelled';
export type ToolCardRisk = 'safe' | 'low' | 'medium' | 'high' | 'critical';

export interface ToolCardInput {
  toolName: string;
  args?: unknown;
  result?: unknown;
  duration?: number;
  isRunning?: boolean;
  isError?: boolean;
  blocked?: boolean;
  cancelled?: boolean;
  riskLevel?: ToolCardRisk;
  approvalToken?: string;
}

export interface ToolCardModel {
  toolName: string;
  status: ToolCardStatus;
  durationLabel?: string;
  riskLevel: ToolCardRisk;
  argumentsSummary: string;
  outputSummary: string;
  errorSummary?: string;
  redacted: boolean;
  safeApprovalToken?: string;
}

export function buildToolCardModel(input: ToolCardInput): ToolCardModel {
  const status = resolveStatus(input);
  const args = input.args === undefined ? '' : safeJson(input.args);
  const output = input.result === undefined ? '' : safeJson(input.result);
  const redactedArgs = redactToolText(args);
  const redactedOutput = redactToolText(output);
  const redactedApproval = input.approvalToken ? redactToolText(input.approvalToken) : undefined;
  const redacted = args !== redactedArgs || output !== redactedOutput || input.approvalToken !== redactedApproval;

  return {
    toolName: redactToolText(input.toolName),
    status,
    durationLabel: input.duration === undefined ? undefined : `${Math.round(input.duration)}ms`,
    riskLevel: input.riskLevel ?? (input.isError ? 'medium' : 'safe'),
    argumentsSummary: summarizeToolText(redactedArgs, 120),
    outputSummary: summarizeToolText(redactedOutput, 200),
    errorSummary: input.isError ? summarizeToolText(redactedOutput || 'Tool failed', 200) : undefined,
    redacted,
    safeApprovalToken: redactedApproval && redactedApproval === input.approvalToken ? redactedApproval : undefined,
  };
}

export function redactToolText(text: string): string {
  return text
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
    .replace(/(cookie\s*:\s*)(.*?)(?=\s+(?:api[_-]?key|access_token|refresh_token|id_token|email_token|token|secret|password)=|\s+(?:sk|pk|rk|whsec|xoxb|ghp|github_pat)_|$)/gi, '$1[redacted]')
    .replace(/\b(access_token|refresh_token|id_token|email_token|token|secret|password|api[_-]?key)=\S+/gi, '$1=[redacted]')
    .replace(/\b(?:sk|pk|rk|whsec|xoxb|ghp|github_pat)_[A-Za-z0-9_=-]{8,}\b/g, '[secret]')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '[id]');
}

export function summarizeToolText(text: string, limit: number): string {
  const compact = text.replace(/\s+/g, ' ').trim();
  if (!compact) return '';
  return compact.length > limit ? `${compact.slice(0, Math.max(0, limit - 3))}...` : compact;
}

function resolveStatus(input: ToolCardInput): ToolCardStatus {
  if (input.blocked) return 'blocked';
  if (input.cancelled) return 'cancelled';
  if (input.isRunning) return 'running';
  if (input.isError) return 'failed';
  if (input.result !== undefined) return 'success';
  return 'pending';
}

function safeJson(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
