/**
 * Installable on-device GGUF catalog for offline chat (llama.rn).
 * Sizes are approximate Q4_K_M artifacts from bartowski Hugging Face repos.
 */

export type LocalModelId =
  | 'llama-3.2-1b-instruct-q4km'
  | 'qwen2.5-1.5b-instruct-q4km'
  | 'gemma-2-2b-it-q4km';

export interface LocalModelCatalogEntry {
  id: LocalModelId;
  displayName: string;
  shortName: string;
  filename: string;
  url: string;
  /** Empty skips full-file SHA256; size check still applies. */
  sha256: string;
  expectedSizeBytes: number;
  downloadLabel: string;
  version: number;
  contextSize: number;
  maxTokens: number;
  temperature: number;
  stopTokens: string[];
  blurb: string;
}

export const LOCAL_MODEL_CATALOG: LocalModelCatalogEntry[] = [
  {
    id: 'llama-3.2-1b-instruct-q4km',
    displayName: 'Llama 3.2 1B',
    shortName: 'Llama 1B',
    filename: 'Llama-3.2-1B-Instruct-Q4_K_M.gguf',
    url: 'https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf',
    sha256: '6f85a640a97cf2bf5b8e764087b1e83da0fdb51d7c9fab7d0fece9385611df83',
    expectedSizeBytes: 807_694_464,
    downloadLabel: '808 MB',
    version: 1,
    contextSize: 4096,
    maxTokens: 1024,
    temperature: 0.7,
    stopTokens: ['<|eot_id|>', '<|end_of_text|>'],
    blurb: 'Smallest option. Fast on most phones.',
  },
  {
    id: 'qwen2.5-1.5b-instruct-q4km',
    displayName: 'Qwen2.5 1.5B',
    shortName: 'Qwen 1.5B',
    filename: 'Qwen2.5-1.5B-Instruct-Q4_K_M.gguf',
    url: 'https://huggingface.co/bartowski/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/Qwen2.5-1.5B-Instruct-Q4_K_M.gguf',
    sha256: '',
    expectedSizeBytes: 1_120_000_000,
    downloadLabel: '1.1 GB',
    version: 1,
    contextSize: 4096,
    maxTokens: 1024,
    temperature: 0.7,
    stopTokens: ['<|im_end|>', '<|endoftext|>'],
    blurb: 'Strong instruction following for its size.',
  },
  {
    id: 'gemma-2-2b-it-q4km',
    displayName: 'Gemma 2 2B',
    shortName: 'Gemma 2B',
    filename: 'gemma-2-2b-it-Q4_K_M.gguf',
    url: 'https://huggingface.co/bartowski/gemma-2-2b-it-GGUF/resolve/main/gemma-2-2b-it-Q4_K_M.gguf',
    sha256: '',
    expectedSizeBytes: 1_629_000_000,
    downloadLabel: '1.6 GB',
    version: 1,
    contextSize: 4096,
    maxTokens: 1024,
    temperature: 0.7,
    stopTokens: ['<end_of_turn>', '<start_of_turn>'],
    blurb: 'Larger on-device model. Better quality, more storage.',
  },
];

/** Default pick: smallest download for first-time installs. */
export const DEFAULT_LOCAL_MODEL_ID: LocalModelId = 'llama-3.2-1b-instruct-q4km';

export function getCatalogEntry(id: string | null | undefined): LocalModelCatalogEntry | null {
  if (!id) return null;
  return LOCAL_MODEL_CATALOG.find((entry) => entry.id === id) ?? null;
}

export function requireCatalogEntry(id: LocalModelId): LocalModelCatalogEntry {
  const entry = getCatalogEntry(id);
  if (!entry) {
    throw new Error(`Unknown local model: ${id}`);
  }
  return entry;
}

/** @deprecated Prefer catalog entry for the active model. */
export const LOCAL_MODEL_ID = DEFAULT_LOCAL_MODEL_ID;
/** @deprecated Prefer catalog entry displayName. */
export const LOCAL_MODEL_DISPLAY_NAME =
  getCatalogEntry(DEFAULT_LOCAL_MODEL_ID)?.displayName ?? 'On-device model';
/** @deprecated Prefer catalog entry. */
export const LOCAL_MODEL_FILENAME =
  getCatalogEntry(DEFAULT_LOCAL_MODEL_ID)?.filename ?? '';
/** @deprecated Prefer catalog entry. */
export const LOCAL_MODEL_URL = getCatalogEntry(DEFAULT_LOCAL_MODEL_ID)?.url ?? '';
/** @deprecated Prefer catalog entry. */
export const LOCAL_MODEL_SHA256 = getCatalogEntry(DEFAULT_LOCAL_MODEL_ID)?.sha256 ?? '';
/** @deprecated Prefer catalog entry. */
export const LOCAL_MODEL_EXPECTED_SIZE_BYTES =
  getCatalogEntry(DEFAULT_LOCAL_MODEL_ID)?.expectedSizeBytes ?? 0;
/** @deprecated Prefer catalog entry. */
export const LOCAL_MODEL_VERSION = 1;
/** @deprecated Prefer catalog entry. */
export const LOCAL_MODEL_CONTEXT_SIZE = 4096;
/** @deprecated Prefer catalog entry. */
export const LOCAL_MODEL_MAX_TOKENS = 1024;
/** @deprecated Prefer catalog entry. */
export const LOCAL_MODEL_TEMPERATURE = 0.7;
/** @deprecated Prefer catalog entry. */
export const LOCAL_MODEL_DOWNLOAD_LABEL =
  getCatalogEntry(DEFAULT_LOCAL_MODEL_ID)?.downloadLabel ?? '';
