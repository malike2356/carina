import type { Request } from 'express';
import { pool } from '../db.js';
import { PromptGuard } from '../security/prompt-guard.js';
import { egressFilter } from '../security/egress-filter.js';
import { honeypotManager } from '../security/honeypot-manager.js';
import { anomalyDetector } from '../security/anomaly-detector.js';
import {
  evaluatePolicy,
  evaluateContext,
  evaluateOutputProtection,
} from '../security/policy-gateway.js';
import { resolveActionTypeFromTool } from '../security/risk-registry.js';
import type {
  PolicyDecision,
  PolicyDecisionKind,
} from '../security/policy-decisions.js';
import {
  decisionToErrorCode,
  isBlockingDecision,
} from '../security/policy-decisions.js';
import type { NormalizedRequest } from './agent-adapter.interface.js';

export interface ScoutPipelineResult {
  blocked: boolean;
  reason?: string;
  decision?: PolicyDecisionKind;
  policyDecision?: PolicyDecision;
  filteredContent?: string;
  code?: string;
}

export interface ScoutPipelineDeps {
  scanUserMessage: (text: string) => Promise<{ blocked: boolean; reason?: string }>;
  isAllowed: (url: string) => boolean;
  checkApiKey: (key: string, meta: Record<string, unknown>) => Promise<boolean>;
  checkResponse: (url: string, body: string) => Promise<void>;
  logEvent: (req: Request | undefined, eventType: string, severity: string, meta: Record<string, unknown>) => Promise<void>;
  fetchFn: typeof fetch;
}

const defaultPromptGuard = new PromptGuard({
  llmRouterUrl: process.env.LABYRINTH_LLM_ROUTER_URL
    ?? (process.env.NODE_ENV === 'production' ? 'http://carina-web:3000' : 'http://localhost:3000'),
  llmModel: process.env.LABYRINTH_JUDGE_MODEL ?? 'deepseek/deepseek-chat',
  llmTimeoutMs: 3000,
  instanceId: 'integration',
  reportFn: async () => {},
});

async function defaultScanUserMessage(text: string): Promise<{ blocked: boolean; reason?: string }> {
  const result = await defaultPromptGuard.scanInput(text);
  if (!result.isMalicious) return { blocked: false };
  return { blocked: true, reason: result.patterns.join(', ') || 'prompt injection detected' };
}

async function defaultLogEvent(
  req: Request | undefined,
  eventType: string,
  severity: string,
  meta: Record<string, unknown>,
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO security_events
        (instance_id, event_type, severity, source, description, metadata, created_at)
       VALUES ($1, $2, $3, 'scout-integration', $4, $5, NOW())`,
      [
        typeof req?.headers['x-scout-instance-id'] === 'string' ? req.headers['x-scout-instance-id'] : 'integration-unknown',
        eventType,
        severity,
        `Integration event: ${eventType}`,
        JSON.stringify({ ip: req?.ip, userAgent: req?.headers['user-agent'], ...meta }),
      ],
    );
  } catch (err) {
    console.error('[ScoutIntegration] Failed to log event:', err);
  }
}

let deps: ScoutPipelineDeps = {
  scanUserMessage: defaultScanUserMessage,
  isAllowed: (url) => egressFilter.isAllowed(url),
  checkApiKey: (key, meta) => honeypotManager.checkApiKey(key, meta),
  checkResponse: (url, body) => egressFilter.checkResponse(url, body),
  logEvent: defaultLogEvent,
  fetchFn: fetch,
};

export function setScoutPipelineDeps(overrides: Partial<ScoutPipelineDeps>): void {
  deps = { ...deps, ...overrides };
}

export function resetScoutPipelineDeps(): void {
  deps = {
    scanUserMessage: defaultScanUserMessage,
    isAllowed: (url) => egressFilter.isAllowed(url),
    checkApiKey: (key, meta) => honeypotManager.checkApiKey(key, meta),
    checkResponse: (url, body) => egressFilter.checkResponse(url, body),
    logEvent: defaultLogEvent,
    fetchFn: fetch,
  };
}

export function getScoutPipelineDeps(): ScoutPipelineDeps {
  return deps;
}

function toPipelineResult(decision: PolicyDecision): ScoutPipelineResult {
  const blocked = isBlockingDecision(decision.decision)
    || decision.decision === 'require_approval';
  return {
    blocked,
    reason: decision.reason,
    decision: decision.decision,
    policyDecision: decision,
    filteredContent: decision.filteredContent,
    code: decisionToErrorCode(decision.decision),
  };
}

export async function inspectRequest(
  request: NormalizedRequest,
  req?: Request,
): Promise<ScoutPipelineResult> {
  const sessionId = request.sessionId ?? 'anonymous';
  const instanceId = typeof req?.headers['x-scout-instance-id'] === 'string'
    ? req.headers['x-scout-instance-id']
    : undefined;

  if (request.prompt) {
    const contextDecision = await evaluateContext(
      request.prompt,
      'user_prompt',
      sessionId,
      req,
    );
    if (contextDecision.decision === 'block' || contextDecision.decision === 'quarantine_session') {
      await deps.logEvent(req, 'context_firewall_blocked', 'critical', {
        agentType: request.agentType,
        sessionId,
        reason: contextDecision.reason,
        action: contextDecision.metadata?.firewallAction,
      });
      return toPipelineResult(contextDecision);
    }
  }

  for (const toolCall of request.toolCalls) {
    const actionType = resolveActionTypeFromTool(toolCall.name);
    const toolDecision = await evaluatePolicy({
      actionType,
      sessionId,
      instanceId,
      toolName: toolCall.name,
      params: toolCall.arguments,
    }, req);

    if (toolDecision.decision !== 'allow') {
      await deps.logEvent(req, 'policy_decision', toolDecision.decision === 'block' ? 'critical' : 'warning', {
        agentType: request.agentType,
        sessionId,
        tool: toolCall.name,
        decision: toolDecision.decision,
        reason: toolDecision.reason,
      });
      return toPipelineResult(toolDecision);
    }
  }

  const metrics = {
    tool_calls_per_5min: request.toolCalls.length,
    unique_tools_used: new Set(request.toolCalls.map((tool) => tool.name)).size,
    avg_response_length: request.prompt.length,
    shell_exec_count: request.toolCalls.filter((tool) => tool.name === 'shell-exec').length,
    http_request_count: request.toolCalls.filter((tool) => tool.name === 'http-request').length,
    injection_attempt_count: 0,
    egress_blocked_count: 0,
  };
  void anomalyDetector.detect(request.agentType, sessionId, metrics).catch(() => undefined);
  return { blocked: false };
}

export async function inspectResponse(
  content: string,
  sessionId: string,
  req?: Request,
  toolName?: string,
): Promise<ScoutPipelineResult> {
  const outputDecision = await evaluateOutputProtection(content, sessionId, req, toolName);
  if (outputDecision.decision === 'block') {
    await deps.logEvent(req, 'output_protection_blocked', 'critical', {
      sessionId,
      toolName,
      reason: outputDecision.reason,
    });
    return toPipelineResult(outputDecision);
  }

  if (outputDecision.filteredContent && outputDecision.filteredContent !== content) {
    return {
      blocked: false,
      filteredContent: outputDecision.filteredContent,
      policyDecision: outputDecision,
      decision: outputDecision.decision,
    };
  }

  return { blocked: false };
}
