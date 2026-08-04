import type { Tool } from '../../types/index.js';
import type { CyberToolDef } from '../cyber-tools-registry.js';
import { buildUpgradeBanner, resolveWorkspaceTier } from '../tier-check.js';
import { runBinary, type BinaryRunResult } from './exec.js';
import { clampInt } from './sanitize.js';

export interface ReconToolSpec {
  def: CyberToolDef;
  parameters: Record<string, unknown>;
  buildArgs: (params: Record<string, unknown>) => string[] | { error: string };
  resolveBinary?: (params: Record<string, unknown>) => string | { error: string };
  formatResult?: (
    result: BinaryRunResult,
    params: Record<string, unknown>,
    startedAt: number,
  ) => unknown | Promise<unknown>;
  defaultTimeoutMs?: number;
  retryArgs?: (
    params: Record<string, unknown>,
    first: BinaryRunResult,
  ) => string[] | null;
}

function defaultFormat(
  def: CyberToolDef,
  result: BinaryRunResult,
  params: Record<string, unknown>,
): Record<string, unknown> {
  const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
  return {
    tool: def.name,
    target: params.target ?? params.domain ?? params.username ?? params.url,
    exitCode: result.exitCode,
    output,
  };
}

export function createReconTool(spec: ReconToolSpec): Tool {
  return {
    name: spec.def.name,
    description: spec.def.description,
    dangerous: true,
    requiresConfirmation: true,
    parameters: spec.parameters,
    execute: async (params) => {
      const built = spec.buildArgs(params);
      if ('error' in built) return built;

      const binary = spec.resolveBinary?.(params) ?? spec.def.binary;
      if (typeof binary !== 'string') return binary;

      const timeoutMs = params.timeout
        ? clampInt(params.timeout, Math.floor((spec.defaultTimeoutMs ?? 180_000) / 1000), 30, 7200) * 1000
        : (spec.defaultTimeoutMs ?? 180_000);

      const startedAt = Date.now();
      let result = await runBinary(binary, built, timeoutMs);

      if (result.exitCode !== 0 && spec.retryArgs) {
        const retry = spec.retryArgs(params, result);
        if (retry) {
          result = await runBinary(binary, retry, timeoutMs);
        }
      }

      const tier = resolveWorkspaceTier();
      const banner = buildUpgradeBanner(tier);
      const body = spec.formatResult
        ? await Promise.resolve(spec.formatResult(result, params, startedAt))
        : defaultFormat(spec.def, result, params);

      if (result.exitCode !== 0 && typeof body === 'object' && body !== null && !('error' in body)) {
        return {
          ...(body as Record<string, unknown>),
          warning: `Process exited with code ${result.exitCode}`,
          stderr: result.stderr.trim() || undefined,
        };
      }

      if (!banner || typeof body !== 'object' || body === null) return body;
      return { ...(body as Record<string, unknown>), upgradeBanner: banner };
    },
  };
}
