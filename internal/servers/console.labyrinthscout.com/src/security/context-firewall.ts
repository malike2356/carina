import { PromptGuard, type InjectionResult } from './prompt-guard.js';
import type {
  ContextFirewallAction,
  ContextSourceType,
  ShieldMode,
} from './policy-decisions.js';
import { getActionRiskScore, scoreToLevel } from './risk-registry.js';

export interface ContextFirewallResult {
  action: ContextFirewallAction;
  content: string;
  reason: string;
  patterns: string[];
  riskScore: number;
}

export interface ContextFirewallDeps {
  scanInput: (text: string) => Promise<InjectionResult>;
  scanToolResult: (toolName: string, result: string) => Promise<InjectionResult>;
}

const defaultGuard = new PromptGuard({
  llmRouterUrl: process.env.LABYRINTH_LLM_ROUTER_URL
    ?? (process.env.NODE_ENV === 'production' ? 'http://carina-web:3000' : 'http://localhost:3000'),
  llmModel: process.env.LABYRINTH_JUDGE_MODEL ?? 'deepseek/deepseek-chat',
  llmTimeoutMs: 3000,
  instanceId: 'context-firewall',
  reportFn: async () => {},
  layer2_enabled: false,
});

let deps: ContextFirewallDeps = {
  scanInput: (text) => defaultGuard.scanInput(text),
  scanToolResult: (toolName, result) => defaultGuard.scanToolResult(toolName, result),
};

export function setContextFirewallDeps(overrides: Partial<ContextFirewallDeps>): void {
  deps = { ...deps, ...overrides };
}

export function resetContextFirewallDeps(): void {
  deps = {
    scanInput: (text) => defaultGuard.scanInput(text),
    scanToolResult: (toolName, result) => defaultGuard.scanToolResult(toolName, result),
  };
}

function redactPatterns(content: string, patterns: string[]): string {
  let result = content;
  for (const pattern of patterns) {
    if (pattern.length > 2) {
      result = result.replace(new RegExp(escapeRegex(pattern), 'gi'), '[REDACTED]');
    }
  }
  return result;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function annotateContent(content: string, reason: string): string {
  return `[SCOUT: untrusted context flagged - ${reason}]\n${content}`;
}

function isolateContent(content: string): string {
  return `[SCOUT: isolated low-trust buffer]\n${content}`;
}

function resolveActionForScan(
  scan: InjectionResult,
  shieldMode: ShieldMode,
  contextType: ContextSourceType,
): ContextFirewallAction {
  if (!scan.isMalicious) return 'pass';

  const isCritical = scan.patterns.some((p) =>
    p.includes('critical') || scan.confidence >= 90,
  );

  if (shieldMode === 'quarantine' || shieldMode === 'restrict') {
    return 'block';
  }

  if (shieldMode === 'guard' && isCritical) {
    return 'block';
  }

  if (contextType === 'tool_output' || contextType === 'web_fetch') {
    if (isCritical) return 'redact';
    return 'annotate';
  }

  if (contextType === 'rag_chunk' || contextType === 'imported_doc' || contextType === 'attachment_text') {
    return 'downgrade_trust';
  }

  if (isCritical) return 'block';
  return 'redact';
}

export async function inspectContext(
  content: string,
  contextType: ContextSourceType,
  shieldMode: ShieldMode,
  toolName?: string,
): Promise<ContextFirewallResult> {
  if (!content.trim()) {
    return { action: 'pass', content, reason: 'empty content', patterns: [], riskScore: 0 };
  }

  const scan = contextType === 'tool_output' && toolName
    ? await deps.scanToolResult(toolName, content)
    : await deps.scanInput(content);

  const baseRisk = getActionRiskScore('tool_chain');
  const riskScore = scan.isMalicious
    ? Math.min(100, baseRisk + scan.confidence)
    : Math.max(0, baseRisk - 30);

  if (!scan.isMalicious) {
    return {
      action: 'pass',
      content,
      reason: 'no threats detected',
      patterns: [],
      riskScore,
    };
  }

  const action = resolveActionForScan(scan, shieldMode, contextType);
  const reason = scan.patterns.join(', ') || 'suspicious content detected';

  let filteredContent = content;
  switch (action) {
    case 'redact':
      filteredContent = scan.sanitized ?? redactPatterns(content, scan.patterns);
      break;
    case 'annotate':
      filteredContent = annotateContent(content, reason);
      break;
    case 'downgrade_trust':
      filteredContent = annotateContent(content, `downgraded trust (${scoreToLevel(riskScore)})`);
      break;
    case 'isolate':
      filteredContent = isolateContent(content);
      break;
    case 'block':
      filteredContent = '';
      break;
    default:
      break;
  }

  return { action, content: filteredContent, reason, patterns: scan.patterns, riskScore };
}

export async function inspectOutput(
  content: string,
  toolName?: string,
  shieldMode: ShieldMode = 'observe',
): Promise<ContextFirewallResult> {
  return inspectContext(content, 'tool_output', shieldMode, toolName);
}
