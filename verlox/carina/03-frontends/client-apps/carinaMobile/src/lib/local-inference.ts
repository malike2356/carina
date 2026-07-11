import type { ChatMessage } from '@/api/types';
import {
  DEFAULT_LOCAL_MODEL_ID,
  getCatalogEntry,
  type LocalModelCatalogEntry,
  type LocalModelId,
} from '@/config/local-model';

const SYSTEM_PROMPT = `You are Carina, an AI assistant running locally on this device.
You have limited capabilities compared to the full cloud version.
You cannot run code, send emails, manage files, or access the internet.
Answer concisely and honestly. If you cannot do something, say so.`;

type LlamaContext = {
  completion: (
    params: {
      messages?: Array<{ role: string; content: string }>;
      n_predict?: number;
      temperature?: number;
      stop?: string[];
    },
    onToken?: (data: { token: string }) => void,
  ) => Promise<{ text: string }>;
  release?: () => Promise<void>;
};

let llamaContext: LlamaContext | null = null;
let modelReady = false;
let loadedEntry: LocalModelCatalogEntry | null = null;
let nativeProbe: { ok: boolean; reason?: string } | null = null;

/** Whether the llama.rn native module is linked in this binary. */
export async function probeLocalInferenceNative(): Promise<{ ok: boolean; reason?: string }> {
  if (nativeProbe) return nativeProbe;
  try {
    const mod = await import('llama.rn');
    if (typeof mod.initLlama !== 'function') {
      nativeProbe = {
        ok: false,
        reason:
          'On-device runtime is incomplete in this build. Install a preview APK with mini models enabled.',
      };
      return nativeProbe;
    }
    nativeProbe = { ok: true };
    return nativeProbe;
  } catch {
    nativeProbe = {
      ok: false,
      reason:
        'On-device mini models need a native build with llama.rn linked (New Architecture). This install cannot load GGUF models.',
    };
    return nativeProbe;
  }
}

export function isLocalModelReady(): boolean {
  return modelReady && llamaContext !== null;
}

export function getLoadedLocalModelId(): LocalModelId | null {
  return loadedEntry?.id ?? null;
}

export function getLoadedLocalModelDisplayName(): string {
  return loadedEntry?.displayName ?? getCatalogEntry(DEFAULT_LOCAL_MODEL_ID)?.displayName ?? 'On-device';
}

export function buildLocalPromptMessages(
  messages: ChatMessage[],
): Array<{ role: string; content: string }> {
  const formatted: Array<{ role: string; content: string }> = [
    { role: 'system', content: SYSTEM_PROMPT },
  ];
  for (const msg of messages.slice(-20)) {
    if (msg.role === 'user' || msg.role === 'assistant') {
      formatted.push({ role: msg.role, content: msg.content });
    }
  }
  return formatted;
}

export async function initLocalModel(
  modelPath: string,
  entry?: LocalModelCatalogEntry | null,
): Promise<boolean> {
  const resolved =
    entry ??
    getCatalogEntry(DEFAULT_LOCAL_MODEL_ID) ??
    null;

  const probe = await probeLocalInferenceNative();
  if (!probe.ok) {
    llamaContext = null;
    loadedEntry = null;
    modelReady = false;
    return false;
  }

  try {
    if (llamaContext?.release) {
      try {
        await llamaContext.release();
      } catch {
        // ignore
      }
    }
    llamaContext = null;
    modelReady = false;

    const { initLlama } = await import('llama.rn');
    llamaContext = await initLlama({
      model: modelPath,
      n_ctx: resolved?.contextSize ?? 4096,
      n_gpu_layers: 0,
    });
    loadedEntry = resolved;
    modelReady = true;
    return true;
  } catch {
    llamaContext = null;
    loadedEntry = null;
    modelReady = false;
    return false;
  }
}

export async function unloadLocalModel(): Promise<void> {
  if (llamaContext?.release) {
    try {
      await llamaContext.release();
    } catch {
      // ignore release errors
    }
  }
  llamaContext = null;
  loadedEntry = null;
  modelReady = false;
}

export async function localChat(
  messages: ChatMessage[],
  signal?: AbortSignal,
): Promise<string> {
  if (!llamaContext || !modelReady) {
    throw new Error('Local model is not loaded');
  }
  if (signal?.aborted) {
    throw new Error('Aborted');
  }

  const result = await llamaContext.completion(
    {
      messages: buildLocalPromptMessages(messages),
      n_predict: loadedEntry?.maxTokens ?? 1024,
      temperature: loadedEntry?.temperature ?? 0.7,
      stop: loadedEntry?.stopTokens ?? ['<|eot_id|>'],
    },
    () => {
      if (signal?.aborted) {
        throw new Error('Aborted');
      }
    },
  );

  return result.text?.trim() ?? '';
}

export async function* localChatStream(
  messages: ChatMessage[],
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const full = await localChat(messages, signal);
  const words = full.split(/(\s+)/);
  for (const word of words) {
    if (signal?.aborted) break;
    yield word;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

// Test-only reset
export function _resetLocalInferenceForTests(): void {
  llamaContext = null;
  loadedEntry = null;
  modelReady = false;
  nativeProbe = null;
}
