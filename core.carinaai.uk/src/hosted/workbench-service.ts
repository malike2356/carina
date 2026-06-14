import { randomUUID } from 'crypto';
import type { Request } from 'express';
import { checkOrgUsageQuota } from '../api/hosted-billing.js';
import { maybeNotifyUsageWarning } from './usage-service.js';
import { LLMRouter } from '../brain/llm.js';
import { getTenantProvider } from '../brain/tenant-provider-keys.js';
import { pool } from '../memory/db.js';
import {
  estimateModelCost,
  estimateTokensFromText,
  getModelPricingForOrg,
} from './ai-platform-models.js';
import { queryForOrg } from './scoped-query.js';
import { writeProductAudit } from './product-audit.js';
import { redactString } from './redact.js';

const MAX_PROMPT_LENGTH = 32_000;

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
  costEstimate: number;
  responseText: string | null;
  createdAt: Date;
}

export interface WorkbenchRunResult {
  runId: string;
  responseText: string;
  tokensIn: number;
  tokensOut: number;
  costEstimate: number;
}

export class WorkbenchValidationError extends Error {
  readonly statusCode = 400;

  constructor(message: string) {
    super(message);
    this.name = 'WorkbenchValidationError';
  }
}

export class WorkbenchQuotaError extends Error {
  readonly statusCode = 429;

  constructor(public readonly used: number, public readonly limit: number) {
    super('Monthly token quota exceeded');
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
            tokens_in, tokens_out, cost_estimate, response_text, created_at
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

export type WorkbenchLlmRunner = (
  prompt: string,
  provider: string,
  model: string,
  tenantId: string,
) => Promise<{ content: string; tokensUsed: number }>;

const defaultLlmRunner: WorkbenchLlmRunner = async (prompt, provider, model, tenantId) => {
  const router = new LLMRouter();
  router.setTenant(tenantId);
  const response = await router.chat(
    [{ role: 'user', content: prompt, timestamp: new Date() }],
    undefined,
    { name: provider, model },
    tenantId,
  );
  return { content: response.content, tokensUsed: response.tokensUsed };
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

  const quota = await checkOrgUsageQuota(input.orgId, input.tenantId);
  if (!quota.allowed) {
    throw new WorkbenchQuotaError(quota.used, quota.limit);
  }

  const tenantKey = await getTenantProvider(input.tenantId, input.provider);
  if (!tenantKey) {
    throw new WorkbenchMissingKeyError(input.provider);
  }

  const runId = randomUUID();
  const title = input.title?.trim() || 'Untitled run';

  await pool.query(
    `INSERT INTO ai_platform_workbench_runs
      (id, org_id, title, prompt, provider, model, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'running')`,
    [runId, input.orgId, title, prompt, input.provider, input.model],
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
      promptLength: prompt.length,
    },
    req: input.req,
  });

  const runner = input.llmRunner ?? defaultLlmRunner;
  const llmResult = await runner(prompt, input.provider, input.model, input.tenantId);

  const tokensIn = estimateTokensFromText(prompt);
  const tokensOut = Math.max(1, llmResult.tokensUsed - tokensIn);
  const pricing = await getModelPricingForOrg(input.orgId, input.provider, input.model);
  const costEstimate = pricing
    ? estimateModelCost(tokensIn, tokensOut, pricing.inputPrice, pricing.outputPrice)
    : 0;

  await pool.query(
    `UPDATE ai_platform_workbench_runs
     SET status = 'completed',
         tokens_in = $2,
         tokens_out = $3,
         cost_estimate = $4,
         response_text = $5
     WHERE id = $1 AND org_id = $6`,
    [runId, tokensIn, tokensOut, costEstimate, llmResult.content, input.orgId],
  );

  await recordOrgUsage({
    orgId: input.orgId,
    tenantId: input.tenantId,
    tokensUsed: tokensIn + tokensOut,
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
      tokensIn,
      tokensOut,
      costEstimate,
    },
    req: input.req,
  });

  return {
    runId,
    responseText: redactString(llmResult.content),
    tokensIn,
    tokensOut,
    costEstimate,
  };
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
    costEstimate: run.costEstimate,
    createdAt: run.createdAt,
    hasResponse: Boolean(run.responseText),
  };
}
