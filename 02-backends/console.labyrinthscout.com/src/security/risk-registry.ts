import type { PolicyActionType } from './policy-decisions.js';
import { canonicalToolName } from './tool-tiers.js';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface RiskEntry {
  actionType: PolicyActionType;
  toolName?: string;
  baseScore: number;
  level: RiskLevel;
  description: string;
}

const ACTION_BASE_SCORES: Record<PolicyActionType, number> = Object.freeze({
  shell: 90,
  http: 60,
  file_write: 70,
  email: 75,
  messaging: 70,
  tool_chain: 50,
  credential: 95,
});

const TOOL_RISK_OVERRIDES: Record<string, number> = Object.freeze({
  terminal: 90,
  'shell-exec': 90,
  'http-request': 60,
  'file-write': 70,
  write_file: 70,
  'email-send': 75,
  email_send: 75,
  'message-send': 70,
});

const HIGH_RISK_TOOLS = new Set([
  'terminal',
  'shell-exec',
  'file-write',
  'write_file',
  'email-send',
  'email_send',
  'http-request',
  'message-send',
]);

export function scoreToLevel(score: number): RiskLevel {
  if (score >= 85) return 'critical';
  if (score >= 65) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

export function getActionRiskScore(actionType: PolicyActionType, toolName?: string): number {
  const canonical = toolName ? canonicalToolName(toolName) : undefined;
  if (canonical && TOOL_RISK_OVERRIDES[canonical] !== undefined) {
    return TOOL_RISK_OVERRIDES[canonical];
  }
  if (toolName && TOOL_RISK_OVERRIDES[toolName] !== undefined) {
    return TOOL_RISK_OVERRIDES[toolName];
  }
  return ACTION_BASE_SCORES[actionType] ?? 50;
}

export function isHighRiskTool(toolName: string): boolean {
  const canonical = canonicalToolName(toolName);
  return HIGH_RISK_TOOLS.has(canonical) || HIGH_RISK_TOOLS.has(toolName);
}

export function resolveActionTypeFromTool(toolName: string): PolicyActionType {
  const canonical = canonicalToolName(toolName);
  if (canonical === 'terminal' || toolName === 'shell-exec') return 'shell';
  if (canonical === 'write_file' || toolName === 'file-write') return 'file_write';
  if (toolName === 'http-request' || toolName.includes('http')) return 'http';
  if (toolName.includes('email') && toolName.includes('send')) return 'email';
  if (toolName.includes('message') || toolName.includes('sms')) return 'messaging';
  if (toolName.includes('credential') || toolName.includes('secret')) return 'credential';
  return 'tool_chain';
}

export function buildRiskEntry(
  actionType: PolicyActionType,
  toolName?: string,
): RiskEntry {
  const baseScore = getActionRiskScore(actionType, toolName);
  return {
    actionType,
    toolName,
    baseScore,
    level: scoreToLevel(baseScore),
    description: `${actionType} action${toolName ? ` via ${toolName}` : ''}`,
  };
}
