import { classifyComplexity } from '../brain/task-classifier.js';
import type { Message } from '../types/index.js';
import { getSessionConfig, setSessionConfig } from '../config/session-config.js';

export type ThinkingLevel =
  | 'off'
  | 'minimal'
  | 'low'
  | 'medium'
  | 'high'
  | 'xhigh'
  | 'max'
  | 'adaptive';

const THINKING_LEVELS: ThinkingLevel[] = [
  'off',
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
  'max',
  'adaptive',
];

const THINKING_TOKEN_BUDGETS: Record<Exclude<ThinkingLevel, 'off' | 'adaptive'>, number> = {
  minimal: 128,
  low: 512,
  medium: 2048,
  high: 4096,
  xhigh: 8192,
  max: 16384,
};

const MODEL_DEFAULTS: Record<string, ThinkingLevel> = {
  'anthropic/claude-opus-4-6': 'high',
  'anthropic/claude-opus-4': 'high',
  'openai/gpt-5.5': 'medium',
  'local/llama-3.3': 'minimal',
};

export function parseThinkingLevel(value: string): ThinkingLevel | null {
  const normalized = value.trim().toLowerCase() as ThinkingLevel;
  return THINKING_LEVELS.includes(normalized) ? normalized : null;
}

export function defaultThinkingLevel(): ThinkingLevel {
  const fromEnv = process.env.CARINA_THINKING_DEFAULT?.trim().toLowerCase();
  if (fromEnv) {
    const parsed = parseThinkingLevel(fromEnv);
    if (parsed) return parsed;
  }
  return 'medium';
}

export function resolveModelDefaultThinking(provider?: string, model?: string): ThinkingLevel | null {
  if (!provider) return null;
  const key = model ? `${provider}/${model}` : provider;
  return MODEL_DEFAULTS[key] ?? MODEL_DEFAULTS[provider] ?? null;
}

export function resolveAdaptiveThinkingLevel(messages: Message[]): ThinkingLevel {
  const complexity = classifyComplexity(messages);
  if (complexity === 'simple') return 'minimal';
  return 'medium';
}

export function resolveSessionThinkingLevel(
  sessionId: string,
  messages: Message[],
  provider?: string,
  model?: string,
): ThinkingLevel {
  const cfg = getSessionConfig(sessionId);
  if (cfg?.fastModeUntilTurn) return 'off';
  if (cfg?.thinkingLevel) {
    if (cfg.thinkingLevel === 'adaptive') {
      return resolveAdaptiveThinkingLevel(messages);
    }
    return cfg.thinkingLevel;
  }
  return resolveModelDefaultThinking(provider, model) ?? defaultThinkingLevel();
}

export function setSessionThinkingLevel(sessionId: string, level: ThinkingLevel): void {
  setSessionConfig(sessionId, { thinkingLevel: level, fastModeUntilTurn: false });
}

export function toggleSessionFastMode(sessionId: string): ThinkingLevel {
  const cfg = getSessionConfig(sessionId);
  const next = cfg?.fastModeUntilTurn ? defaultThinkingLevel() : 'off';
  setSessionConfig(sessionId, {
    thinkingLevel: next === 'off' ? 'off' : cfg?.thinkingLevel ?? defaultThinkingLevel(),
    fastModeUntilTurn: next === 'off',
  });
  return next;
}

export function isFastThinkingLevel(level: ThinkingLevel): boolean {
  return level === 'off';
}

export function formatThinkingStatus(sessionId: string): string {
  const cfg = getSessionConfig(sessionId);
  if (cfg?.fastModeUntilTurn) return 'Thinking: off (fast mode active for this session)';
  const level = cfg?.thinkingLevel ?? defaultThinkingLevel();
  const budget =
    level !== 'off' && level !== 'adaptive'
      ? THINKING_TOKEN_BUDGETS[level]
      : null;
  return budget
    ? `Thinking: ${level} (~${budget} token budget when provider supports it)`
    : `Thinking: ${level}`;
}

function mapToOpenAIEffort(level: ThinkingLevel): string {
  switch (level) {
    case 'minimal':
      return 'minimal';
    case 'low':
      return 'low';
    case 'medium':
      return 'medium';
    case 'high':
    case 'xhigh':
    case 'max':
      return 'high';
    default:
      return 'medium';
  }
}

export function mapThinkingLevelToProvider(
  level: ThinkingLevel,
  provider: string,
): Record<string, unknown> {
  if (level === 'off') return { enabled: false };
  if (level === 'adaptive') return { enabled: true };

  const budget = THINKING_TOKEN_BUDGETS[level];
  const normalized = provider.toLowerCase();

  if (normalized === 'anthropic' || normalized === 'bedrock') {
    return { thinking: { type: 'enabled', budget_tokens: budget } };
  }
  if (normalized === 'openai' || normalized === 'azure' || normalized === 'openrouter') {
    return { reasoning_effort: mapToOpenAIEffort(level) };
  }
  if (normalized === 'gemini' || normalized === 'google') {
    return { thinkingConfig: { thinkingBudget: budget } };
  }
  return { thinking_tokens: budget };
}

export function applyThinkingExtrasToProviderRequest(
  request: Record<string, unknown>,
  extras: Record<string, unknown>,
): Record<string, unknown> {
  if (extras.enabled === false) return request;
  if (extras.thinking) return { ...request, thinking: extras.thinking };
  if (extras.reasoning_effort) return { ...request, reasoning_effort: extras.reasoning_effort };
  if (extras.thinkingConfig) return { ...request, thinkingConfig: extras.thinkingConfig };
  if (extras.thinking_tokens) return { ...request, max_completion_tokens: extras.thinking_tokens };
  return request;
}
