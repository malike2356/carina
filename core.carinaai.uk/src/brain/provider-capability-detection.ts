import type { ProviderDefinition } from './provider-registry.js';
import {
  PROVIDER_MAP,
  providerModel,
  providerTransportType,
} from './provider-registry.js';

export type ReasoningEffortMode =
  | 'none'
  | 'openai-parameter'
  | 'anthropic-thinking'
  | 'gemini-thinking'
  | 'native-reasoner';

export interface ReasoningEffortDetection {
  supported: boolean;
  mode: ReasoningEffortMode;
  levels?: string[];
  notes?: string;
}

export interface StreamingCompatibility {
  text: boolean;
  tools: boolean;
  vision: boolean;
  transport: string;
  notes: string;
}

export interface ProviderCapabilityReport {
  name: string;
  displayName: string;
  status: string;
  configured: boolean;
  transport: string;
  capabilities: ProviderDefinition['capabilities'];
  streaming: StreamingCompatibility;
  reasoningEffort: ReasoningEffortDetection;
  model: string;
}

const O_SERIES_MODEL = /\b(o\d[\w-]*|gpt-5[\w.-]*)\b/i;
const REASONER_MODEL = /\b(reasoner|r1|deepseek-r|think)\b/i;
const GEMINI_THINKING = /thinking|2\.5-pro/i;
const CLAUDE_THINKING = /claude-(sonnet-4|opus-4|3-7)/i;

export function detectReasoningEffort(provider: string, model?: string): ReasoningEffortDetection {
  const def = PROVIDER_MAP[provider];
  const resolvedModel = (model ?? (def ? providerModel(def) : '')).toLowerCase();

  if (!def?.capabilities.reasoning && !def?.capabilities.reasoningEffort) {
    return { supported: false, mode: 'none' };
  }

  if (provider === 'anthropic' || (provider === 'bedrock' && resolvedModel.includes('claude'))) {
    const modelSupports = !resolvedModel || CLAUDE_THINKING.test(resolvedModel) || resolvedModel.includes('claude');
    return {
      supported: modelSupports,
      mode: modelSupports ? 'anthropic-thinking' : 'none',
      notes: modelSupports
        ? 'Extended thinking via thinking blocks and budget tokens'
        : 'Pick a Claude 3.7+ or Claude 4 model for thinking',
    };
  }

  if (provider === 'gemini') {
    const modelSupports = GEMINI_THINKING.test(resolvedModel);
    return {
      supported: modelSupports,
      mode: modelSupports ? 'gemini-thinking' : 'none',
      levels: modelSupports ? ['low', 'medium', 'high'] : undefined,
      notes: modelSupports
        ? 'Thinking budget on Gemini 2.5 thinking models'
        : 'Use a Gemini thinking model (e.g. gemini-2.5-pro) for effort control',
    };
  }

  if (
    (provider === 'openai' || provider === 'azure' || provider === 'openrouter' || provider === 'custom')
    && O_SERIES_MODEL.test(resolvedModel)
  ) {
    return {
      supported: true,
      mode: 'openai-parameter',
      levels: ['low', 'medium', 'high'],
      notes: 'reasoning_effort request parameter on o-series and gpt-5 models',
    };
  }

  if (REASONER_MODEL.test(resolvedModel) || resolvedModel.includes('deepseek-r')) {
    return {
      supported: true,
      mode: 'native-reasoner',
      notes: 'Reasoning tokens emitted in model output (no separate effort knob)',
    };
  }

  if (def.capabilities.reasoningEffort || def.capabilities.reasoning) {
    return {
      supported: false,
      mode: 'none',
      notes: 'Provider has reasoning models; select a reasoning-capable model id',
    };
  }

  return { supported: false, mode: 'none' };
}

export function detectStreamingCompatibility(def: ProviderDefinition): StreamingCompatibility {
  const transport = providerTransportType(def);
  const caps = def.capabilities;
  let notes = '';

  if (!caps.streaming) {
    notes = 'Non-streaming adapter';
  } else if (transport === 'google-generative') {
    notes = caps.tools
      ? 'Text streams; tool calls may arrive in a final chunk'
      : 'Native Gemini streaming';
  } else if (transport === 'anthropic-messages') {
    notes = 'SSE message deltas; tool input can stream';
  } else if (transport === 'openai-compatible') {
    notes = caps.tools
      ? 'OpenAI-style SSE; tool call deltas when model supports it'
      : 'OpenAI-style text SSE';
  } else if (transport === 'external-cli') {
    notes = 'External CLI stdout; not API streaming';
  }

  const streamingTools = caps.streamingTools
    ?? (caps.streaming && caps.tools && transport !== 'google-generative');

  return {
    text: caps.streaming,
    tools: streamingTools,
    vision: caps.streaming && caps.vision,
    transport,
    notes,
  };
}

export function buildProviderCapabilityReport(
  def: ProviderDefinition,
  options?: { model?: string; configured?: boolean },
): ProviderCapabilityReport {
  const model = options?.model ?? providerModel(def);
  return {
    name: def.name,
    displayName: def.displayName,
    status: def.status,
    configured: options?.configured ?? false,
    transport: providerTransportType(def),
    capabilities: def.capabilities,
    streaming: detectStreamingCompatibility(def),
    reasoningEffort: detectReasoningEffort(def.name, model),
    model,
  };
}

export function formatReasoningEffortLine(detection: ReasoningEffortDetection): string {
  if (!detection.supported) {
    return detection.notes ? `no (${detection.notes})` : 'no';
  }
  const levels = detection.levels?.length ? ` [${detection.levels.join(', ')}]` : '';
  return `${detection.mode}${levels}${detection.notes ? `; ${detection.notes}` : ''}`;
}

export function formatStreamingLine(streaming: StreamingCompatibility): string {
  const parts = [
    streaming.text ? 'text' : 'text:no',
    streaming.tools ? 'tools' : 'tools:no',
    streaming.vision ? 'vision' : 'vision:no',
  ];
  return `${parts.join(', ')} (${streaming.transport})`;
}

/** Human-readable rows for `carina providers matrix`. */
export function streamingMatrixRows(
  defs: ProviderDefinition[],
): Array<{
  name: string;
  transport: string;
  stream: boolean;
  streamTools: boolean;
  tools: boolean;
  vision: boolean;
  reasoning: boolean;
  reasoningEffort: boolean;
  status: string;
}> {
  return defs.map((def) => {
    const stream = detectStreamingCompatibility(def);
    const effort = detectReasoningEffort(def.name);
    return {
      name: def.name,
      transport: stream.transport,
      stream: stream.text,
      streamTools: stream.tools,
      tools: def.capabilities.tools,
      vision: def.capabilities.vision,
      reasoning: Boolean(def.capabilities.reasoning),
      reasoningEffort: effort.supported || Boolean(def.capabilities.reasoningEffort),
      status: def.status,
    };
  });
}
