import { loadFromYamlSync } from '../cli/config/loader.js';
import type { AuxiliaryModelConfig, AuxiliaryModelMap, AuxiliaryTaskName } from '../types/auxiliary-model.js';
import type { Message } from '../types/index.js';
import { llm } from './llm.js';

export type ResolvedAuxiliaryConfig = AuxiliaryModelConfig & {
  provider: string;
  model: string;
};

function resolvePrimaryConfig(): { provider: string; model: string } {
  const config = loadFromYamlSync();
  let provider = process.env.DEFAULT_PROVIDER ?? config.provider;
  let model = process.env.DEFAULT_MODEL ?? config.model;
  try {
    provider = provider || llm.current().name;
    model = model || llm.currentModel();
  } catch {
    provider = provider || 'deepseek';
    model = model || 'deepseek-chat';
  }
  return { provider, model };
}

export function resolveAuxiliaryConfig(task: AuxiliaryTaskName): ResolvedAuxiliaryConfig {
  const config = loadFromYamlSync();
  const primary = resolvePrimaryConfig();
  const aux: AuxiliaryModelConfig = config.auxiliaryModels?.[task] ?? {};

  return {
    provider: aux.provider ?? primary.provider,
    model: aux.model ?? primary.model,
    maxTokens: aux.maxTokens,
    reasoningEffort: aux.reasoningEffort,
    temperature: aux.temperature,
  };
}

function buildMessages(prompt: string, systemPrompt?: string): Message[] {
  const messages: Message[] = [];
  if (systemPrompt?.trim()) {
    messages.push({ role: 'system', content: systemPrompt.trim(), timestamp: new Date() });
  }
  messages.push({ role: 'user', content: prompt, timestamp: new Date() });
  return messages;
}

function trimAuxiliaryOutput(content: string, cfg: ResolvedAuxiliaryConfig): string {
  const trimmed = content.trim();
  if (!cfg.maxTokens || cfg.maxTokens <= 0) return trimmed;
  const charBudget = cfg.maxTokens * 4;
  return trimmed.length > charBudget ? trimmed.slice(0, charBudget) : trimmed;
}

async function invokeProvider(
  provider: string,
  model: string,
  messages: Message[],
): Promise<string> {
  const response = await llm.chat(messages, undefined, { name: provider, model });
  return response.content ?? '';
}

export async function callAuxiliaryModel(
  task: keyof AuxiliaryModelMap,
  prompt: string,
  systemPrompt?: string,
): Promise<string> {
  const cfg = resolveAuxiliaryConfig(task);
  const messages = buildMessages(prompt, systemPrompt);

  try {
    const content = await invokeProvider(cfg.provider, cfg.model, messages);
    return trimAuxiliaryOutput(content, cfg);
  } catch (err) {
    const primary = resolvePrimaryConfig();
    if (cfg.provider === primary.provider && cfg.model === primary.model) {
      throw err;
    }
    const content = await invokeProvider(primary.provider, primary.model, messages);
    return trimAuxiliaryOutput(content, cfg);
  }
}
