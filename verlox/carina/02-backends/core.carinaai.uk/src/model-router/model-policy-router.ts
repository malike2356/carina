import type { Message, Tool } from '../types/index.js';
import { pricingForModel, rawProviderCostGbp } from '../billing/aiva-ai-pricing.js';
import { countMessageTokens } from '../brain/token-counter.js';

export type ModelPolicyTier = 'mini_or_local' | 'openai_action' | 'claude_deep';
export type ModelPolicyBillingMode = 'free' | 'subscription' | 'byok' | 'internal' | 'operator_override';
export type ModelPolicyRisk = 'low' | 'medium' | 'high' | 'regulated' | 'security_sensitive';
export type ModelPolicyTaskType =
  | 'simple_chat'
  | 'rewrite'
  | 'classification'
  | 'summary'
  | 'draft'
  | 'tool_call'
  | 'ui_operation'
  | 'channel_operation'
  | 'workflow'
  | 'math'
  | 'deep_reasoning'
  | 'persistent_task'
  | 'critical_business'
  | 'coding';

export interface ModelPolicyContext {
  messages: Message[];
  tools?: Tool[];
  userPlan?: string;
  billingMode?: ModelPolicyBillingMode;
  hasByok?: boolean;
  remainingAllowance?: number;
  usedAllowance?: number;
  workspacePolicy?: {
    allowedTiers?: ModelPolicyTier[];
    maxEstimatedCostGbp?: number;
    allowMiniFallback?: boolean;
  };
  taskType?: ModelPolicyTaskType;
  riskLevel?: ModelPolicyRisk;
  requiredToolCapability?: boolean;
  contextLengthTokens?: number;
  expectedOutputTokens?: number;
  expectedOutputValue?: 'low' | 'medium' | 'high' | 'critical';
  budgetRemainingGbp?: number;
  adminOverride?: boolean;
}

export interface ModelPolicyDecision {
  tier: ModelPolicyTier;
  selectedProvider: string;
  selectedModel: string;
  fallbackProvider: string;
  fallbackModel: string;
  reason: string;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedCostGbp: number;
  budgetImpact: 'none' | 'low' | 'medium' | 'high' | 'blocked';
  approvalRequired: boolean;
  subscriptionUpgradeRequired: boolean;
  allowed: boolean;
  downgradeMessage?: string;
  warningMessage?: string;
  auditRequired: boolean;
}

export interface ModelPolicyRouterOptions {
  miniProvider?: string;
  miniModel?: string;
  openaiProvider?: string;
  openaiModel?: string;
  claudeProvider?: string;
  claudeModel?: string;
  freeMessageAllowance?: number;
}

const HIGH_RISK_TASKS = new Set<ModelPolicyTaskType>([
  'math',
  'deep_reasoning',
  'persistent_task',
  'critical_business',
]);

const ACTION_TASKS = new Set<ModelPolicyTaskType>([
  'tool_call',
  'ui_operation',
  'channel_operation',
  'workflow',
  'coding',
]);

function latestUserText(messages: Message[]): string {
  return [...messages].reverse().find((message) => message.role === 'user')?.content ?? '';
}

function normalizePlan(plan: string | undefined): string {
  return String(plan ?? 'free').trim().toLowerCase() || 'free';
}

function envValue(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return value || fallback;
}

function envIntValue(name: string, fallback: number): number {
  const value = Number(process.env[name]?.trim());
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 1) return fallback;
  return value;
}

function inferTaskType(messages: Message[], tools: Tool[] | undefined): ModelPolicyTaskType {
  if (tools?.length) return 'tool_call';
  const text = latestUserText(messages).toLowerCase();
  if (/\b(math|calculate|calculation|equation|formula|statistical|astronomical|super ?computing)\b/.test(text)) return 'math';
  if (/\b(deep reasoning|reason deeply|mission critical|critical|high stakes|serious decision)\b/.test(text)) return 'critical_business';
  if (/\b(long persistent|keep working|multi[- ]?day|persistent task|project plan)\b/.test(text)) return 'persistent_task';
  if (/\b(workflow|automation|assign task|execute|tool|send email|channel|whatsapp|slack)\b/.test(text)) return 'workflow';
  if (/\b(code|implement|debug|refactor|test|deploy|build)\b/.test(text)) return 'coding';
  if (/\b(classify|label|route this)\b/.test(text)) return 'classification';
  if (/\b(rewrite|reword|edit this)\b/.test(text)) return 'rewrite';
  if (/\b(summary|summarise|summarize)\b/.test(text)) return 'summary';
  if (/\b(draft|write a short|compose)\b/.test(text)) return 'draft';
  return 'simple_chat';
}

function inferRisk(taskType: ModelPolicyTaskType): ModelPolicyRisk {
  if (taskType === 'critical_business' || taskType === 'persistent_task') return 'high';
  if (taskType === 'math' || taskType === 'workflow' || taskType === 'tool_call' || taskType === 'channel_operation') return 'medium';
  return 'low';
}

function chooseTier(input: {
  taskType: ModelPolicyTaskType;
  riskLevel: ModelPolicyRisk;
  contextLengthTokens: number;
  requiredToolCapability: boolean;
  expectedOutputValue: ModelPolicyContext['expectedOutputValue'];
}): { tier: ModelPolicyTier; reason: string } {
  if (
    HIGH_RISK_TASKS.has(input.taskType)
    || input.expectedOutputValue === 'critical'
    || input.riskLevel === 'regulated'
    || input.contextLengthTokens >= 18_000
  ) {
    return {
      tier: 'claude_deep',
      reason: 'Deep reasoning tier selected for criticality, math, long context, or high-risk reasoning.',
    };
  }

  if (
    input.requiredToolCapability
    || ACTION_TASKS.has(input.taskType)
    || input.riskLevel === 'security_sensitive'
    || input.riskLevel === 'medium'
  ) {
    return {
      tier: 'openai_action',
      reason: 'Action tier selected for tool use, workflow execution, channel work, coding, or medium-risk operations.',
    };
  }

  return {
    tier: 'mini_or_local',
    reason: 'Mini tier selected for simple, low-risk work.',
  };
}

function budgetImpact(cost: number, remaining: number | undefined): ModelPolicyDecision['budgetImpact'] {
  if (remaining == null) return cost > 0 ? 'low' : 'none';
  if (remaining <= 0 || cost > remaining) return 'blocked';
  const ratio = cost / Math.max(remaining, 0.000001);
  if (ratio >= 0.5) return 'high';
  if (ratio >= 0.2) return 'medium';
  return cost > 0 ? 'low' : 'none';
}

function isPaidPlan(plan: string): boolean {
  return !['free', 'trial', 'community', 'starter-free'].includes(plan);
}

function safeMiniFallback(taskType: ModelPolicyTaskType, riskLevel: ModelPolicyRisk): boolean {
  return !HIGH_RISK_TASKS.has(taskType) && riskLevel === 'low';
}

export class ModelPolicyRouter {
  private readonly options: Required<ModelPolicyRouterOptions>;

  constructor(options: ModelPolicyRouterOptions = {}) {
    this.options = {
      miniProvider: options.miniProvider ?? envValue('CARINA_MINI_PROVIDER', 'deepseek'),
      miniModel: options.miniModel ?? envValue('CARINA_MINI_MODEL', 'deepseek-chat'),
      openaiProvider: options.openaiProvider ?? envValue('CARINA_OPENAI_ACTION_PROVIDER', 'openai'),
      openaiModel: options.openaiModel ?? envValue('CARINA_OPENAI_ACTION_MODEL', 'gpt-4o'),
      claudeProvider: options.claudeProvider ?? envValue('CARINA_CLAUDE_DEEP_PROVIDER', 'anthropic'),
      claudeModel: options.claudeModel ?? envValue('CARINA_CLAUDE_DEEP_MODEL', 'claude-sonnet-4-6'),
      freeMessageAllowance: options.freeMessageAllowance ?? envIntValue('CARINA_CLOUD_FREE_DAILY_MESSAGES', 20),
    };
  }

  decide(context: ModelPolicyContext): ModelPolicyDecision {
    const tools = context.tools ?? [];
    const taskType = context.taskType ?? inferTaskType(context.messages, tools);
    const riskLevel = context.riskLevel ?? inferRisk(taskType);
    const inputTokens = context.contextLengthTokens ?? countMessageTokens(context.messages).tokens;
    const outputTokens = context.expectedOutputTokens ?? Math.min(4096, Math.max(256, Math.ceil(inputTokens * 0.35)));
    const tierChoice = chooseTier({
      taskType,
      riskLevel,
      contextLengthTokens: inputTokens,
      requiredToolCapability: context.requiredToolCapability ?? tools.length > 0,
      expectedOutputValue: context.expectedOutputValue,
    });
    const configured = this.modelsForTier(tierChoice.tier);
    const fallback = this.modelsForTier(tierChoice.tier === 'mini_or_local' ? 'openai_action' : 'mini_or_local');
    const plan = normalizePlan(context.userPlan);
    const billingMode = context.adminOverride
      ? 'operator_override'
      : context.billingMode ?? (context.hasByok ? 'byok' : isPaidPlan(plan) ? 'subscription' : 'free');
    const estimatedCostGbp = rawProviderCostGbp(configured.model, {
      inputTokens,
      outputTokens,
    });
    const impact = budgetImpact(estimatedCostGbp, context.budgetRemainingGbp);
    const allowedByWorkspace = !context.workspacePolicy?.allowedTiers
      || context.workspacePolicy.allowedTiers.includes(tierChoice.tier);
    const overFreeAllowance = billingMode === 'free'
      && !context.hasByok
      && (context.remainingAllowance != null
        ? context.remainingAllowance <= 0
        : (context.usedAllowance ?? 0) >= this.options.freeMessageAllowance);
    const overWorkspaceCost = context.workspacePolicy?.maxEstimatedCostGbp != null
      && estimatedCostGbp > context.workspacePolicy.maxEstimatedCostGbp;
    const overBudget = billingMode === 'subscription'
      && context.budgetRemainingGbp != null
      && estimatedCostGbp > context.budgetRemainingGbp;

    let allowed = allowedByWorkspace && !overWorkspaceCost;
    let tier = tierChoice.tier;
    let provider = configured.provider;
    let model = configured.model;
    let reason = tierChoice.reason;
    let subscriptionUpgradeRequired = false;
    let downgradeMessage: string | undefined;
    let warningMessage: string | undefined;

    if (billingMode === 'byok') {
      allowed = allowedByWorkspace;
      reason += ' BYOK is active, so provider-cost enforcement is externalized while safety controls remain active.';
    } else if (billingMode === 'operator_override') {
      allowed = true;
      reason += ' Operator override allowed this request and requires audit review.';
    } else if (overFreeAllowance) {
      if ((context.workspacePolicy?.allowMiniFallback ?? true) && safeMiniFallback(taskType, riskLevel)) {
        tier = 'mini_or_local';
        const mini = this.modelsForTier(tier);
        provider = mini.provider;
        model = mini.model;
        downgradeMessage = 'Your free hosted allowance is finished, so this low-risk request will continue on mini mode. Add BYOK or subscribe for action and deep reasoning tiers.';
        reason = 'Free allowance exhausted; safe low-risk request downgraded to mini tier.';
        allowed = true;
      } else {
        allowed = false;
        subscriptionUpgradeRequired = true;
        reason = 'Free allowance exhausted and the requested task needs a paid or BYOK tier.';
      }
    } else if (overBudget) {
      if ((context.workspacePolicy?.allowMiniFallback ?? true) && safeMiniFallback(taskType, riskLevel)) {
        tier = 'mini_or_local';
        const mini = this.modelsForTier(tier);
        provider = mini.provider;
        model = mini.model;
        downgradeMessage = 'This request would exceed the current plan budget, so Carina is using mini mode for safe low-risk work.';
        reason = 'Plan budget guard downgraded a safe low-risk request to mini tier.';
        allowed = true;
      } else {
        allowed = false;
        subscriptionUpgradeRequired = true;
        reason = 'This request would exceed the current plan economics and cannot be safely downgraded.';
      }
    }

    if (billingMode === 'subscription' && context.budgetRemainingGbp != null && context.budgetRemainingGbp > 0) {
      const remainingAfter = context.budgetRemainingGbp - estimatedCostGbp;
      if (remainingAfter > 0 && remainingAfter <= context.budgetRemainingGbp * 0.2) {
        warningMessage = 'Usage is close to the current plan budget. BYOK, top-up, or upgrade before high-value work is blocked.';
      }
    }

    return {
      tier,
      selectedProvider: provider,
      selectedModel: model,
      fallbackProvider: fallback.provider,
      fallbackModel: fallback.model,
      reason,
      estimatedInputTokens: inputTokens,
      estimatedOutputTokens: outputTokens,
      estimatedCostGbp,
      budgetImpact: allowed ? budgetImpact(estimatedCostGbp, context.budgetRemainingGbp) : 'blocked',
      approvalRequired: tier === 'claude_deep'
        || riskLevel === 'high'
        || riskLevel === 'regulated'
        || riskLevel === 'security_sensitive',
      subscriptionUpgradeRequired,
      allowed,
      downgradeMessage,
      warningMessage,
      auditRequired: billingMode === 'operator_override',
    };
  }

  private modelsForTier(tier: ModelPolicyTier): { provider: string; model: string } {
    if (tier === 'openai_action') {
      return { provider: this.options.openaiProvider, model: this.options.openaiModel };
    }
    if (tier === 'claude_deep') {
      return { provider: this.options.claudeProvider, model: this.options.claudeModel };
    }
    return { provider: this.options.miniProvider, model: this.options.miniModel };
  }

  estimateModelPrice(model: string): { in: number; out: number } {
    return pricingForModel(model);
  }
}

export const modelPolicyRouter = new ModelPolicyRouter();
