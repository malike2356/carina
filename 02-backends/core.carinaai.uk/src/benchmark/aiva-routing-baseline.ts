import fs from 'node:fs/promises';
import path from 'node:path';
import { globalCarinaHome } from '../config/paths.js';

export type BaselineObservation = 'observed' | 'not_observed';

export type AivaBaselineInput = {
  request?: Partial<{
    tenantId: string;
    workspaceId: string;
    workerId: string;
    contactId: string;
    conversationId: string;
    channel: string;
    consent: string;
  }>;
  selected?: Partial<{
    engine: string;
    provider: string;
    model: string;
    tier: string;
    source: string;
    policy: string;
  }>;
  execution?: Partial<{
    provider: string;
    model: string;
    handledByKeprix: boolean;
    handledByCarina: boolean;
    fallback: boolean;
    fallbackReason: string;
  }>;
  resources?: Partial<{
    promptBudget: number;
    contextBudget: number;
    memorySources: string[];
    tools: string[];
    toolRounds: number;
    retries: number;
    latencyMs: number;
    tokenUsage: number;
    errorClass: string;
  }>;
  routingDifferences?: Record<string, string>;
  silentFailurePaths?: string[];
};

export type AivaBaseline = {
  schemaVersion: 'aiva-routing-baseline.v1';
  generatedAt: string;
  observation: BaselineObservation;
  request: Record<string, string>;
  selected: Record<string, string>;
  execution: {
    provider: string;
    model: string;
    handledByKeprix: boolean;
    handledByCarina: boolean;
    fallback: boolean;
    fallbackReason: string;
    verified: boolean;
  };
  resources: {
    promptBudget: number | null;
    contextBudget: number | null;
    memorySources: string[];
    tools: string[];
    toolRounds: number | null;
    retries: number | null;
    latencyMs: number | null;
    tokenUsage: number | null;
    errorClass: string;
  };
  routingDifferences: Record<string, string>;
  silentFailurePaths: string[];
};

const UNKNOWN = 'not_observed';

function stringValue(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value.trim() : UNKNOWN;
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Build a redacted, tenant-safe routing baseline. Engine truth is verified only
 * when the provider that actually executed inference matches the selected one.
 */
export function buildAivaRoutingBaseline(input: AivaBaselineInput = {}): AivaBaseline {
  const request = Object.fromEntries(Object.entries({
    tenantId: input.request?.tenantId,
    workspaceId: input.request?.workspaceId,
    workerId: input.request?.workerId,
    contactId: input.request?.contactId,
    conversationId: input.request?.conversationId,
    channel: input.request?.channel,
    consent: input.request?.consent,
  }).map(([key, value]) => [key, stringValue(value)]));
  const selected = Object.fromEntries(Object.entries({
    engine: input.selected?.engine,
    provider: input.selected?.provider,
    model: input.selected?.model,
    tier: input.selected?.tier,
    source: input.selected?.source,
    policy: input.selected?.policy ?? process.env.AIVA_ENGINE_POLICY,
  }).map(([key, value]) => [key, stringValue(value)]));
  const execution = {
    provider: stringValue(input.execution?.provider),
    model: stringValue(input.execution?.model),
    handledByKeprix: input.execution?.handledByKeprix === true,
    handledByCarina: input.execution?.handledByCarina === true,
    fallback: input.execution?.fallback === true,
    fallbackReason: stringValue(input.execution?.fallbackReason),
    verified: stringValue(input.execution?.provider) !== UNKNOWN
      && stringValue(selected.provider) !== UNKNOWN
      && stringValue(input.execution?.provider) === stringValue(selected.provider),
  };
  const resources = {
    promptBudget: numberValue(input.resources?.promptBudget),
    contextBudget: numberValue(input.resources?.contextBudget),
    memorySources: Array.isArray(input.resources?.memorySources) ? [...input.resources.memorySources] : [],
    tools: Array.isArray(input.resources?.tools) ? [...input.resources.tools] : [],
    toolRounds: numberValue(input.resources?.toolRounds),
    retries: numberValue(input.resources?.retries),
    latencyMs: numberValue(input.resources?.latencyMs),
    tokenUsage: numberValue(input.resources?.tokenUsage),
    errorClass: stringValue(input.resources?.errorClass),
  };
  return {
    schemaVersion: 'aiva-routing-baseline.v1',
    generatedAt: new Date().toISOString(),
    observation: execution.verified ? 'observed' : 'not_observed',
    request,
    selected,
    execution,
    resources,
    routingDifferences: input.routingDifferences ?? {
      owner: 'full agent loop, governed workspace authorization',
      employee: 'workspace policy and role authorization apply',
      public_customer: 'published knowledge and bounded customer-safe tools',
      audience_principal: 'public session isolation and no owner memory access',
    },
    silentFailurePaths: input.silentFailurePaths ?? [
      'generic operation failure without correlation id',
      'provider label recorded from configuration instead of execution metadata',
      'tool error converted into an unrelated conversational response',
    ],
  };
}

export function renderAivaRoutingBaselineMarkdown(report: AivaBaseline): string {
  const lines = [
    '# Aiva routing and quality baseline',
    '',
    `Generated: ${report.generatedAt}`,
    `Schema: ${report.schemaVersion}`,
    `Observation: ${report.observation}`,
    '',
    '## Request scope',
    '',
    ...Object.entries(report.request).map(([key, value]) => `- ${key}: ${value}`),
    '',
    '## Selected route',
    '',
    ...Object.entries(report.selected).map(([key, value]) => `- ${key}: ${value}`),
    '',
    '## Execution truth',
    '',
    ...Object.entries(report.execution).map(([key, value]) => `- ${key}: ${String(value)}`),
    '',
    '## Context, tools, and failure evidence',
    '',
    `- promptBudget: ${report.resources.promptBudget ?? UNKNOWN}`,
    `- contextBudget: ${report.resources.contextBudget ?? UNKNOWN}`,
    `- memorySources: ${report.resources.memorySources.join(', ') || UNKNOWN}`,
    `- tools: ${report.resources.tools.join(', ') || UNKNOWN}`,
    `- toolRounds: ${report.resources.toolRounds ?? UNKNOWN}`,
    `- retries: ${report.resources.retries ?? UNKNOWN}`,
    `- latencyMs: ${report.resources.latencyMs ?? UNKNOWN}`,
    `- tokenUsage: ${report.resources.tokenUsage ?? UNKNOWN}`,
    `- errorClass: ${report.resources.errorClass}`,
    '',
    '## Routing differences',
    '',
    ...Object.entries(report.routingDifferences).map(([key, value]) => `- ${key}: ${value}`),
    '',
    '## Silent failure paths under review',
    '',
    ...report.silentFailurePaths.map((pathItem) => `- ${pathItem}`),
    '',
    'This report contains no prompt text, secrets, credentials, or personal content.',
    '',
  ];
  return lines.join('\n');
}

export async function writeAivaRoutingBaseline(
  report: AivaBaseline,
  directory = path.join(globalCarinaHome(), 'data', 'evaluations'),
): Promise<{ jsonPath: string; markdownPath: string }> {
  await fs.mkdir(directory, { recursive: true });
  const jsonPath = path.join(directory, 'aiva-routing-baseline-801.json');
  const markdownPath = path.join(directory, 'aiva-routing-baseline-801.md');
  await fs.writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await fs.writeFile(markdownPath, renderAivaRoutingBaselineMarkdown(report), 'utf8');
  return { jsonPath, markdownPath };
}
