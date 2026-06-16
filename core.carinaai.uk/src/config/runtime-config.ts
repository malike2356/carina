import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { CARINA_HOME } from './paths.js';
import {
  RuntimeConfigFileSchema,
  type AgentRuntimeOverride,
  type ConfigValidationIssue,
  type ResolvedBudgetConfig,
  type ResolvedTurnConfig,
  type RuntimeConfigFile,
  type TurnPolicy,
} from './runtime-schema.js';
import type { SessionConfigOverrides } from './session-config.js';

export const RUNTIME_CONFIG_PATH = path.join(CARINA_HOME, 'runtime.yaml');

const DEFAULT_BUDGET: ResolvedBudgetConfig = {
  monthlyUsd: null,
  turnWarnUsd: 0.05,
  warnAtPercent: 80,
  blockExpensiveOnWarn: false,
};

const DEFAULT_TURNS: ResolvedTurnConfig = {
  maxTurns: 20,
  subagentMaxTurns: 10,
  taskflowMaxTurns: 8,
  parentIterationBudget: 90,
  subagentIterationBudget: 50,
  graceCall: true,
};

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function floatEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = parseFloat(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function boolEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  if (raw === 'false' || raw === '0') return false;
  if (raw === 'true' || raw === '1') return true;
  return fallback;
}

function readRuntimeFile(configPath = RUNTIME_CONFIG_PATH): RuntimeConfigFile | null {
  if (!fs.existsSync(configPath)) return null;
  try {
    const parsed = YAML.parse(fs.readFileSync(configPath, 'utf8'));
    const result = RuntimeConfigFileSchema.safeParse(parsed ?? {});
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

function mergeBudget(file: RuntimeConfigFile | null): ResolvedBudgetConfig {
  const fileBudget = file?.budget ?? {};
  const envMonthly = process.env.CARINA_LLM_MONTHLY_BUDGET_USD;
  const monthlyFromEnv = envMonthly ? parseFloat(envMonthly) : null;
  return {
    monthlyUsd: fileBudget.monthlyUsd ?? (Number.isFinite(monthlyFromEnv) ? monthlyFromEnv : null),
    turnWarnUsd: fileBudget.turnWarnUsd ?? floatEnv('CARINA_LLM_TURN_WARN_USD', DEFAULT_BUDGET.turnWarnUsd),
    warnAtPercent: fileBudget.warnAtPercent ?? intEnv('CARINA_BUDGET_WARN_PERCENT', DEFAULT_BUDGET.warnAtPercent),
    blockExpensiveOnWarn: fileBudget.blockExpensiveOnWarn
      ?? boolEnv('CARINA_BLOCK_EXPENSIVE_ON_BUDGET_WARN', DEFAULT_BUDGET.blockExpensiveOnWarn),
  };
}

function mergeTurns(file: RuntimeConfigFile | null): ResolvedTurnConfig {
  const fileTurns = file?.turns ?? {};
  return {
    maxTurns: fileTurns.max ?? intEnv('CARINA_MAX_TURNS', DEFAULT_TURNS.maxTurns),
    subagentMaxTurns: fileTurns.subagentMax ?? intEnv('CARINA_SUBAGENT_MAX_TURNS', DEFAULT_TURNS.subagentMaxTurns),
    taskflowMaxTurns: fileTurns.taskflowMax ?? intEnv('CARINA_TASKFLOW_MAX_TURNS', DEFAULT_TURNS.taskflowMaxTurns),
    parentIterationBudget: fileTurns.parentIterationBudget
      ?? intEnv('CARINA_PARENT_ITERATION_BUDGET', DEFAULT_TURNS.parentIterationBudget),
    subagentIterationBudget: fileTurns.subagentIterationBudget
      ?? intEnv('CARINA_SUBAGENT_ITERATION_BUDGET', DEFAULT_TURNS.subagentIterationBudget),
    graceCall: fileTurns.graceCall ?? boolEnv('CARINA_ITERATION_GRACE_CALL', DEFAULT_TURNS.graceCall),
  };
}

export function getResolvedBudgetConfig(configPath = RUNTIME_CONFIG_PATH): ResolvedBudgetConfig {
  return mergeBudget(readRuntimeFile(configPath));
}

export function getResolvedTurnConfig(configPath = RUNTIME_CONFIG_PATH): ResolvedTurnConfig {
  return mergeTurns(readRuntimeFile(configPath));
}

export function getAgentRuntimeOverride(
  agentId: string,
  configPath = RUNTIME_CONFIG_PATH,
): AgentRuntimeOverride | undefined {
  const file = readRuntimeFile(configPath);
  return file?.agents?.[agentId];
}

export function resolveTurnPolicy(input: {
  agentId?: string;
  subagent?: boolean;
  sessionOverrides?: SessionConfigOverrides;
  configPath?: string;
}): TurnPolicy {
  const turns = getResolvedTurnConfig(input.configPath);
  const budget = getResolvedBudgetConfig(input.configPath);
  const agentOverride = input.agentId ? getAgentRuntimeOverride(input.agentId, input.configPath) : undefined;
  const session = input.sessionOverrides;

  const baseMaxTurns = input.subagent ? turns.subagentMaxTurns : turns.maxTurns;
  const baseIterationBudget = input.subagent
    ? turns.subagentIterationBudget
    : turns.parentIterationBudget;

  return {
    maxTurns: session?.maxTurns ?? agentOverride?.maxTurns ?? baseMaxTurns,
    iterationBudget: session?.iterationBudget ?? agentOverride?.iterationBudget ?? baseIterationBudget,
    graceCallEnabled: turns.graceCall,
    blockExpensiveModels: session?.blockExpensiveModels
      ?? agentOverride?.blockExpensiveModels
      ?? budget.blockExpensiveOnWarn,
    provider: session?.provider ?? agentOverride?.provider,
    model: session?.model ?? agentOverride?.model,
  };
}

export function validateRuntimeConfig(configPath = RUNTIME_CONFIG_PATH): ConfigValidationIssue[] {
  const issues: ConfigValidationIssue[] = [];

  if (!fs.existsSync(configPath)) {
    return issues;
  }

  let raw: unknown;
  try {
    raw = YAML.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (err) {
    issues.push({
      path: configPath,
      message: err instanceof Error ? err.message : String(err),
    });
    return issues;
  }

  const parsed = RuntimeConfigFileSchema.safeParse(raw ?? {});
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      issues.push({
        path: issue.path.join('.') || 'runtime.yaml',
        message: issue.message,
      });
    }
  }

  const monthly = process.env.CARINA_LLM_MONTHLY_BUDGET_USD;
  if (monthly && !Number.isFinite(parseFloat(monthly))) {
    issues.push({
      path: 'CARINA_LLM_MONTHLY_BUDGET_USD',
      message: 'must be a number',
    });
  }

  return issues;
}

export function migrateRuntimeConfig(configPath = RUNTIME_CONFIG_PATH): string[] {
  const added: string[] = [];
  const defaults: RuntimeConfigFile = {
    version: 1,
    budget: {
      monthlyUsd: null,
      turnWarnUsd: DEFAULT_BUDGET.turnWarnUsd,
      warnAtPercent: DEFAULT_BUDGET.warnAtPercent,
      blockExpensiveOnWarn: DEFAULT_BUDGET.blockExpensiveOnWarn,
    },
    turns: {
      max: DEFAULT_TURNS.maxTurns,
      subagentMax: DEFAULT_TURNS.subagentMaxTurns,
      taskflowMax: DEFAULT_TURNS.taskflowMaxTurns,
      parentIterationBudget: DEFAULT_TURNS.parentIterationBudget,
      subagentIterationBudget: DEFAULT_TURNS.subagentIterationBudget,
      graceCall: DEFAULT_TURNS.graceCall,
    },
    agents: {},
  };

  if (!fs.existsSync(configPath)) {
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, YAML.stringify(defaults), { mode: 0o600 });
    return Object.keys(defaults);
  }

  const current = readRuntimeFile(configPath);
  if (!current) {
    fs.writeFileSync(configPath, YAML.stringify(defaults), { mode: 0o600 });
    return ['version', 'budget', 'turns', 'agents'];
  }

  const merged: RuntimeConfigFile = {
    version: current.version ?? 1,
    budget: { ...defaults.budget, ...current.budget },
    turns: { ...defaults.turns, ...current.turns },
    agents: current.agents ?? {},
  };

  for (const key of ['version', 'budget', 'turns', 'agents'] as const) {
    if ((current as Record<string, unknown>)[key] === undefined) {
      added.push(key);
    }
  }

  if (added.length > 0 || JSON.stringify(current) !== JSON.stringify(merged)) {
    fs.writeFileSync(configPath, YAML.stringify(merged), { mode: 0o600 });
  }

  return added;
}

export function formatRuntimeConfigSummary(configPath = RUNTIME_CONFIG_PATH): string {
  const budget = getResolvedBudgetConfig(configPath);
  const turns = getResolvedTurnConfig(configPath);
  const lines = [
    'Runtime config:',
    `  max turns: parent ${turns.maxTurns}, subagent ${turns.subagentMaxTurns}, taskflow ${turns.taskflowMaxTurns}`,
    `  iteration budget: parent ${turns.parentIterationBudget}, subagent ${turns.subagentIterationBudget}, grace ${turns.graceCall ? 'on' : 'off'}`,
  ];
  if (budget.monthlyUsd !== null) {
    lines.push(`  monthly LLM budget: $${budget.monthlyUsd.toFixed(2)} (warn at ${budget.warnAtPercent}%)`);
  } else {
    lines.push('  monthly LLM budget: not set');
  }
  lines.push(`  turn cost warn threshold: $${budget.turnWarnUsd.toFixed(4)}`);
  lines.push(`  block expensive models on budget warn: ${budget.blockExpensiveOnWarn ? 'yes' : 'no'}`);
  return lines.join('\n');
}
