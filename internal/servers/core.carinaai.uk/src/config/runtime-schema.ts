import { z } from 'zod';

export const AgentRuntimeOverrideSchema = z.object({
  maxTurns: z.number().int().min(1).max(500).optional(),
  iterationBudget: z.number().int().min(1).max(500).optional(),
  provider: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  blockExpensiveModels: z.boolean().optional(),
});

export const RuntimeConfigFileSchema = z.object({
  version: z.number().int().min(1).default(1),
  budget: z.object({
    monthlyUsd: z.number().min(0).nullable().optional(),
    turnWarnUsd: z.number().min(0).optional(),
    warnAtPercent: z.number().min(50).max(100).optional(),
    blockExpensiveOnWarn: z.boolean().optional(),
  }).optional(),
  turns: z.object({
    max: z.number().int().min(1).max(500).optional(),
    subagentMax: z.number().int().min(1).max(500).optional(),
    taskflowMax: z.number().int().min(1).max(500).optional(),
    parentIterationBudget: z.number().int().min(1).max(500).optional(),
    subagentIterationBudget: z.number().int().min(1).max(500).optional(),
    graceCall: z.boolean().optional(),
  }).optional(),
  agents: z.record(z.string(), AgentRuntimeOverrideSchema).optional(),
});

export type RuntimeConfigFile = z.infer<typeof RuntimeConfigFileSchema>;
export type AgentRuntimeOverride = z.infer<typeof AgentRuntimeOverrideSchema>;

export type ResolvedBudgetConfig = {
  monthlyUsd: number | null;
  turnWarnUsd: number;
  warnAtPercent: number;
  blockExpensiveOnWarn: boolean;
};

export type ResolvedTurnConfig = {
  maxTurns: number;
  subagentMaxTurns: number;
  taskflowMaxTurns: number;
  parentIterationBudget: number;
  subagentIterationBudget: number;
  graceCall: boolean;
};

export type TurnPolicy = {
  maxTurns: number;
  iterationBudget: number;
  graceCallEnabled: boolean;
  blockExpensiveModels: boolean;
  provider?: string;
  model?: string;
};

export type ConfigValidationIssue = {
  path: string;
  message: string;
};
