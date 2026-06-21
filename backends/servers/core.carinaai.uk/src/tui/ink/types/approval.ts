import type { ToolRiskTier } from '../../../security/tool-risk.js';

export type ApprovalRiskLevel = ToolRiskTier;

export interface ApprovalRequest {
  id: string;
  toolName: string;
  args: Record<string, unknown>;
  reason: string;
  riskLevel: ApprovalRiskLevel;
}

export interface ClarifyState {
  question: string;
  options?: string[];
}
