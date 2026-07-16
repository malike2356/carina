export interface SandboxOptions {
  timeout?: number;
  memoryLimitMb?: number;
  outputLimitBytes?: number;
}

export interface SandboxResult {
  success: boolean;
  result?: unknown;
  error?: string;
  durationMs: number;
  tier?: string;
}

export const DEFAULT_SANDBOX_OPTIONS: Required<SandboxOptions> = {
  timeout: parseInt(process.env.SANDBOX_TIMEOUT_MS ?? '30000', 10),
  memoryLimitMb: parseInt(process.env.SANDBOX_MEMORY_MB ?? '128', 10),
  outputLimitBytes: 1_048_576,
};

export const RESULT_MARKER = '__SANDBOX_RESULT__';
