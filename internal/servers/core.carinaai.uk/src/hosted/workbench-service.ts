import { randomUUID } from 'crypto';
import type { Request } from 'express';
import { estimateCost } from '../brain/cost-tracker.js';
import { LLMRouter } from '../brain/llm.js';
import { checkCreditGate, isModelClassAllowedOnPlan } from '../billing/credit-gate.js';
import { debitCredits, getMonthlyBalance, recordByokUsage } from '../billing/credit-ledger.js';
import { BILLING_PLANS, type BillingPlanId } from '../billing/plans.js';
import { billingPlanIdFromOrgPlan } from '../billing/ops-metering-service.js';
import {
  classifyModel,
  computeBillableCredits,
  estimateCreditsForCall,
  getCurrentRateCard,
  type ModelClass,
} from '../billing/rate-card.js';
import { pool } from '../memory/db.js';
import {
  estimateModelCost,
  estimateTokensFromText,
  getModelPricingForOrg,
} from './ai-platform-models.js';
import { getOrgPlan } from './plan-gates.js';
import { queryForOrg } from './scoped-query.js';
import { writeProductAudit } from './product-audit.js';
import { redactString } from './redact.js';
import { maybeNotifyUsageWarning } from './usage-service.js';
import {
  resolveWorkbenchInferenceMode,
  type WorkbenchInferenceMode,
  type WorkbenchInferencePreference,
} from './workbench-inference.js';

const MAX_PROMPT_LENGTH = 32_000;
const DEFAULT_OUTPUT_TOKEN_ESTIMATE = 1000;

export interface WorkbenchRun {
  id: string;
  orgId: string;
  title: string;
  prompt: string;
  provider: string;
  model: string;
  status: string;
  tokensIn: number;
  tokensOut: number;
  tokensCached: number;
  modelClass: string | null;
  creditsBilled: number;
  costEstimate: number;
  responseText: string | null;
  createdAt: Date;
}

export interface WorkbenchRunResult {
  runId: string;
  responseText: string;
  tokensIn: number;
  tokensOut: number;
  tokensCached: number;
  modelClass: string;
  creditsBilled: number;
  costEstimate: number;
  inferenceMode: WorkbenchInferenceMode;
}

export interface WorkbenchLlmResult {
  content: string;
  tokensIn: number;
  tokensOut: number;
  tokensCached: number;
  tokensUsed: number;
}

export class WorkbenchValidationError extends Error {
  readonly statusCode = 400;

  constructor(message: string) {
    super(message);
    this.name = 'WorkbenchValidationError';
  }
}

export class WorkbenchCreditsError extends Error {
  readonly statusCode = 429;

  constructor(
    public readonly code:
      | 'credits_exhausted'
      | 'model_class_blocked'
      | 'credit_hard_cap'
      | 'margin_blocked',
    message: string,
    public readonly modelClass: string,
    public readonly used: number,
    public readonly limit: number,
    public readonly remaining: number,
  ) {
    super(message);
    this.name = 'WorkbenchCreditsError';
  }
}

/** @deprecated Use WorkbenchCreditsError */
export class WorkbenchQuotaError extends WorkbenchCreditsError {
  constructor(used: number, limit: number) {
    super(
      'credits_exhausted',
      'Monthly credit allowance exhausted',
      'balanced',
      used,
      limit,
      0,
    );
    this.name = 'WorkbenchQuotaError';
  }
}

export class WorkbenchMissingKeyError extends Error {
  readonly statusCode = 400;

  constructor(provider: string) {
    super(`No BYOK key configured for provider: ${provider}`);
    this.name = 'WorkbenchMissingKeyError';
  }
}

export class WorkbenchInferenceUnavailableError extends Error {
  readonly statusCode = 400;

  constructor(
    public readonly provider: string,
    public readonly byokAvailable: boolean,
    public readonly managedAvailable: boolean,
  ) {
    super(`No inference path available for provider: ${provider}`);
    this.name = 'WorkbenchInferenceUnavailableError';
  }
}

async function resolveBillingPlanId(orgId: string): Promise<BillingPlanId> {
  const orgPlan = await getOrgPlan(orgId);
  return billingPlanIdFromOrgPlan(orgPlan);
}

function mapRun(row: Record<string, unknown>): WorkbenchRun {
  return {
    id: String(row.id),
    orgId: String(row.org_id),
    title: String(row.title),
    prompt: String(row.prompt),
    provider: String(row.provider),
    model: String(row.model),
    status: String(row.status),
    tokensIn: Number(row.tokens_in),
    tokensOut: Number(row.tokens_out),
    tokensCached: Number(row.tokens_cached ?? 0),
    modelClass: row.model_class != null ? String(row.model_class) : null,
    creditsBilled: Number(row.credits_billed ?? 0),
    costEstimate: Number(row.cost_estimate),
    responseText: row.response_text != null ? String(row.response_text) : null,
    createdAt: row.created_at as Date,
  };
}

export async function listWorkbenchRuns(orgId: string, limit = 20): Promise<WorkbenchRun[]> {
  const capped = Math.min(Math.max(limit, 1), 100);
  const result = await queryForOrg(
    orgId,
    `SELECT id, org_id, title, prompt, provider, model, status,
            tokens_in, tokens_out, tokens_cached, model_class, credits_billed,
            cost_estimate, response_text, created_at
     FROM ai_platform_workbench_runs
     WHERE org_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [capped],
  );
  return result.rows.map(mapRun);
}

export async function orgHasWorkbenchRun(orgId: string): Promise<boolean> {
  const result = await queryForOrg<{ count: string }>(
    orgId,
    `SELECT COUNT(*)::TEXT AS count
     FROM ai_platform_workbench_runs
     WHERE org_id = $1 AND status = 'completed'`,
  );
  return Number(result.rows[0]?.count ?? 0) > 0;
}

/** Legacy usage_records row; prefer ops_credit_ledger for billing. */
async function recordOrgUsage(input: {
  orgId: string;
  tenantId: string;
  tokensUsed: number;
  model: string;
  costEstimate: number;
}): Promise<void> {
  await pool.query(
    `INSERT INTO usage_records (tenant_id, org_id, date, tokens_used, model, cost_estimate)
     VALUES ($1, $2, CURRENT_DATE, $3, $4, $5)`,
    [input.tenantId, input.orgId, input.tokensUsed, input.model, input.costEstimate],
  );
  await maybeNotifyUsageWarning(input.orgId, input.tenantId);
}

async function markRunFailed(runId: string, orgId: string): Promise<void> {
  await pool.query(
    `UPDATE ai_platform_workbench_runs
     SET status = 'failed'
     WHERE id = $1 AND org_id = $2`,
    [runId, orgId],
  );
}

function resolveDirectionalTokens(
  prompt: string,
  llmResult: WorkbenchLlmResult,
): { tokensIn: number; tokensOut: number; tokensCached: number } {
  let tokensIn = llmResult.tokensIn;
  let tokensOut = llmResult.tokensOut;
  let tokensCached = llmResult.tokensCached;

  if (tokensIn <= 0 && tokensOut <= 0 && llmResult.tokensUsed > 0) {
    tokensIn = estimateTokensFromText(prompt);
    tokensOut = Math.max(1, llmResult.tokensUsed - tokensIn);
    tokensCached = 0;
  }

  return { tokensIn, tokensOut, tokensCached };
}

async function assertWorkbenchModelClassAllowed(
  orgId: string,
  model: string,
): Promise<{ planId: BillingPlanId; modelClass: ModelClass; rateCard: Awaited<ReturnType<typeof getCurrentRateCard>> }> {
  const planId = await resolveBillingPlanId(orgId);
  const modelClass = classifyModel(model);
  const allowed = await isModelClassAllowedOnPlan(planId, modelClass);
  if (!allowed) {
    throw new WorkbenchCreditsError(
      'model_class_blocked',
      'model class not available on your plan',
      modelClass,
      0,
      0,
      0,
    );
  }

  const rateCard = await getCurrentRateCard(modelClass);

  return { planId, modelClass, rateCard };
}

function creditsErrorCodeFromGateReason(reason: string | undefined): WorkbenchCreditsError['code'] {
  if (reason?.includes('hard cap')) return 'credit_hard_cap';
  if (reason?.includes('margin')) return 'margin_blocked';
  return 'credits_exhausted';
}

async function assertManagedWorkbenchCreditGate(input: {
  orgId: string;
  planId: BillingPlanId;
  modelClass: ModelClass;
  rateCard: Awaited<ReturnType<typeof getCurrentRateCard>>;
  prompt: string;
  provider: string;
}): Promise<void> {
  const tokensIn = estimateTokensFromText(input.prompt);
  const estimatedCredits = estimateCreditsForCall(
    input.rateCard,
    tokensIn,
    DEFAULT_OUTPUT_TOKEN_ESTIMATE,
  );
  const estimatedProviderCostUsd = estimateCost(
    input.provider,
    tokensIn + DEFAULT_OUTPUT_TOKEN_ESTIMATE,
  );
  const gate = await checkCreditGate(
    input.orgId,
    input.planId,
    input.modelClass,
    estimatedCredits,
    {
      managedInference: true,
      estimatedProviderCostUsd,
    },
  );

  if (gate.allowed) return;

  const plan = BILLING_PLANS[input.planId];
  const balance = await getMonthlyBalance(input.orgId, input.planId);
  const effectiveLimit = (plan.includedCredits ?? 0) + balance.topups;

  throw new WorkbenchCreditsError(
    creditsErrorCodeFromGateReason(gate.reason),
    gate.reason ?? 'Run blocked on your plan',
    input.modelClass,
    balance.used,
    effectiveLimit,
    gate.remainingCredits,
  );
}

export type WorkbenchLlmRunner = (
  prompt: string,
  provider: string,
  model: string,
  tenantId: string,
) => Promise<WorkbenchLlmResult>;

const defaultByokLlmRunner: WorkbenchLlmRunner = async (prompt, provider, model, tenantId) => {
  const router = new LLMRouter();
  router.setTenant(tenantId);
  const response = await router.chat(
    [{ role: 'user', content: prompt, timestamp: new Date() }],
    undefined,
    { name: provider, model },
    tenantId,
  );

  return {
    content: response.content,
    tokensIn: response.tokensIn,
    tokensOut: response.tokensOut,
    tokensCached: response.tokensCached,
    tokensUsed: response.tokensUsed,
  };
};

const defaultManagedLlmRunner: WorkbenchLlmRunner = async (prompt, provider, model) => {
  const router = new LLMRouter();
  const response = await router.chat(
    [{ role: 'user', content: prompt, timestamp: new Date() }],
    undefined,
    { name: provider, model },
    undefined,
  );

  return {
    content: response.content,
    tokensIn: response.tokensIn,
    tokensOut: response.tokensOut,
    tokensCached: response.tokensCached,
    tokensUsed: response.tokensUsed,
  };
};

export async function executeWorkbenchRun(input: {
  orgId: string;
  tenantId: string;
  actorUserId: string;
  prompt: string;
  provider: string;
  model: string;
  title?: string;
  req?: Request;
  inferencePreference?: WorkbenchInferencePreference;
  llmRunner?: WorkbenchLlmRunner;
}): Promise<WorkbenchRunResult> {
  const prompt = input.prompt.trim();
  if (!prompt) {
    throw new WorkbenchValidationError('Prompt is required');
  }
  if (prompt.length > MAX_PROMPT_LENGTH) {
    throw new WorkbenchValidationError(`Prompt exceeds ${MAX_PROMPT_LENGTH} characters`);
  }
  if (!input.provider.trim() || !input.model.trim()) {
    throw new WorkbenchValidationError('Provider and model are required');
  }

  const preference = input.inferencePreference ?? 'auto';
  const inferenceMode = await resolveWorkbenchInferenceMode(
    input.tenantId,
    input.provider,
    preference,
  );

  if (!inferenceMode) {
    const { getWorkbenchInferenceCapabilities } = await import('./workbench-inference.js');
    const caps = await getWorkbenchInferenceCapabilities(input.tenantId, input.provider);
    if (preference === 'byok') {
      throw new WorkbenchMissingKeyError(input.provider);
    }
    throw new WorkbenchInferenceUnavailableError(
      input.provider,
      caps.byok,
      caps.managed,
    );
  }

  const { planId, modelClass, rateCard } = await assertWorkbenchModelClassAllowed(
    input.orgId,
    input.model,
  );

  if (inferenceMode === 'managed') {
    await assertManagedWorkbenchCreditGate({
      orgId: input.orgId,
      planId,
      modelClass,
      rateCard,
      prompt,
      provider: input.provider,
    });
  }

  const runId = randomUUID();
  const title = input.title?.trim() || 'Untitled run';

  await pool.query(
    `INSERT INTO ai_platform_workbench_runs
      (id, org_id, title, prompt, provider, model, status, model_class)
     VALUES ($1, $2, $3, $4, $5, $6, 'running', $7)`,
    [runId, input.orgId, title, prompt, input.provider, input.model, modelClass],
  );

  await writeProductAudit({
    orgId: input.orgId,
    actorUserId: input.actorUserId,
    action: 'workbench.run_started',
    resourceType: 'workbench_run',
    resourceId: runId,
    details: {
      provider: input.provider,
      model: input.model,
      modelClass,
      inferenceMode,
      promptLength: prompt.length,
    },
    req: input.req,
  });

  const runner = input.llmRunner ?? (
    inferenceMode === 'managed' ? defaultManagedLlmRunner : defaultByokLlmRunner
  );

  try {
    const llmResult = await runner(prompt, input.provider, input.model, input.tenantId);
    const { tokensIn, tokensOut, tokensCached } = resolveDirectionalTokens(prompt, llmResult);
    const tokensUsed = tokensIn + tokensOut;

    const pricing = await getModelPricingForOrg(input.orgId, input.provider, input.model);
    const costEstimate = pricing
      ? estimateModelCost(tokensIn, tokensOut, pricing.inputPrice, pricing.outputPrice)
      : 0;

    const creditsBilled = computeBillableCredits(rateCard, tokensIn, tokensOut, tokensCached);
    const providerCostUsd = estimateCost(input.provider, tokensUsed);

    const billedCredits = inferenceMode === 'managed' ? creditsBilled : 0;

    await pool.query(
      `UPDATE ai_platform_workbench_runs
       SET status = 'completed',
           tokens_in = $2,
           tokens_out = $3,
           tokens_cached = $4,
           model_class = $5,
           credits_billed = $6,
           cost_estimate = $7,
           response_text = $8
       WHERE id = $1 AND org_id = $9`,
      [
        runId,
        tokensIn,
        tokensOut,
        tokensCached,
        modelClass,
        billedCredits,
        costEstimate,
        llmResult.content,
        input.orgId,
      ],
    );

    if (inferenceMode === 'managed') {
      await debitCredits({
        orgId: input.orgId,
        tenantId: input.tenantId,
        sessionId: runId,
        model: input.model,
        modelClass,
        rateCardId: rateCard.id,
        credits: creditsBilled,
        providerCostUsd,
      });
    } else {
      await recordByokUsage({
        orgId: input.orgId,
        sessionId: runId,
        model: input.model,
        modelClass,
        providerCostUsd,
      });
    }

    await recordOrgUsage({
      orgId: input.orgId,
      tenantId: input.tenantId,
      tokensUsed,
      model: input.model,
      costEstimate,
    });

    await writeProductAudit({
      orgId: input.orgId,
      actorUserId: input.actorUserId,
      action: 'workbench.run_completed',
      resourceType: 'workbench_run',
      resourceId: runId,
      details: {
        provider: input.provider,
        model: input.model,
        modelClass,
        inferenceMode,
        tokensIn,
        tokensOut,
        tokensCached,
        creditsBilled: billedCredits,
        costEstimate,
      },
      req: input.req,
    });

    return {
      runId,
      responseText: redactString(llmResult.content),
      tokensIn,
      tokensOut,
      tokensCached,
      modelClass,
      creditsBilled: billedCredits,
      costEstimate,
      inferenceMode,
    };
  } catch (err) {
    await markRunFailed(runId, input.orgId);
    throw err;
  }
}

export function summarizeRun(run: WorkbenchRun): Omit<WorkbenchRun, 'prompt' | 'responseText'> & {
  hasResponse: boolean;
} {
  return {
    id: run.id,
    orgId: run.orgId,
    title: run.title,
    provider: run.provider,
    model: run.model,
    status: run.status,
    tokensIn: run.tokensIn,
    tokensOut: run.tokensOut,
    tokensCached: run.tokensCached,
    modelClass: run.modelClass,
    creditsBilled: run.creditsBilled,
    costEstimate: run.costEstimate,
    createdAt: run.createdAt,
    hasResponse: Boolean(run.responseText),
  };
}
