export type ModelFormat = 'gguf' | 'safetensors' | 'awq' | 'fp8';

export type ServeBackend = 'ollama' | 'llama.cpp' | 'vllm' | 'lm-studio';

export interface CatalogEntry {
  id: string;
  displayName: string;
  family: string;
  paramCount: string;
  quantization: string;
  format: ModelFormat;
  vramRequiredGb: number;
  ramRequiredGb: number;
  diskGb: number;
  downloadUrl: string;
  serveVia: ServeBackend[];
  strengths: string[];
  license: string;
  contextWindow: number;
  ollamaTag?: string;
}

export interface GpuInfo {
  vendor: string;
  model: string;
  vramGb: number;
}

export interface HardwareProfile {
  platform: NodeJS.Platform;
  cpuCores: number;
  ramGb: number;
  diskFreeGb: number;
  gpu: GpuInfo | null;
  warnings: string[];
}

export type HardwareTier = 'cpu-only' | 'low-vram' | 'mid-vram' | 'high-vram';

export interface Recommendation {
  tier: HardwareTier;
  recommended: CatalogEntry[];
  marginal: CatalogEntry[];
  excluded: { entry: CatalogEntry; reason: string }[];
}

export interface ServeCommands {
  download: string[];
  serve: string[];
  envKeys: Record<string, string>;
  notes: string[];
}
