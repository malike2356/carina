import type { ProviderKind } from './provider-registry.js';
import { PROVIDER_MAP } from './provider-registry.js';
import { classifyModel } from '../billing/rate-card.js';

export type ModelFamily =
  | 'anthropic'
  | 'openai'
  | 'gemini'
  | 'deepseek'
  | 'reasoning'
  | 'local';

export function resolveModelFamily(provider: string, model: string): ModelFamily {
  const def = PROVIDER_MAP[provider];
  const kind: ProviderKind | undefined = def?.kind;
  const modelLower = model.toLowerCase();
  const tier = classifyModel(model);

  if (def?.local) return 'local';
  if (tier === 'premium' || tier === 'frontier' || modelLower.includes('reasoner') || modelLower.startsWith('o3')) {
    return 'reasoning';
  }
  if (kind === 'anthropic') return 'anthropic';
  if (kind === 'gemini') return 'gemini';
  if (provider === 'deepseek' || modelLower.includes('deepseek')) return 'deepseek';
  return 'openai';
}

const OVERLAYS: Record<ModelFamily, string[]> = {
  anthropic: [
    'Anthropic models: prefer concise tool calls; batch independent reads when safe.',
    'Do not wrap tool arguments in markdown fences.',
    'Verify deliverables against tool output before declaring DONE; do not fabricate results.',
  ],
  openai: [
    'OpenAI-compatible models: function tools only; keep JSON arguments strict.',
    'Prefer one tool call per logical step unless the API supports parallel calls.',
    'Do not stop early when another tool call would improve the result; retry on empty or partial tool output.',
  ],
  gemini: [
    'Gemini models: keep tool schemas minimal; avoid nested optional fields when possible.',
    'Long context is available; still prefer retrieval tools over pasting huge blobs.',
  ],
  deepseek: [
    'DeepSeek models: cost-efficient default; escalate to a premium model only when reasoning depth is required.',
    'Do not hallucinate file contents, command output, or API responses; use real tool calls.',
    'Do not stop early or invent results; verify deliverables before declaring DONE.',
  ],
  reasoning: [
    'Reasoning-tier model active: use fewer, higher-quality tool calls; avoid exploratory loops.',
    'Summarize intermediate results instead of re-sending full tool output when possible.',
  ],
  local: [
    'Local model active: smaller context and slower throughput; prefer smaller tool payloads.',
    'Fall back to a cloud provider if repeated tool failures suggest capacity limits.',
  ],
};

export function buildModelFamilyOverlay(provider: string, model: string): string | null {
  const family = resolveModelFamily(provider, model);
  const lines = OVERLAYS[family];
  if (!lines.length) return null;
  return `Model-family guidance (${family}):\n${lines.map((line) => `- ${line}`).join('\n')}`;
}
