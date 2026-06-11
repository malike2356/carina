import { findEvalPathsForPack } from './fixtures.js';
import { runEval } from './runner.js';
import { saveReport } from './report.js';
import type { EvalGateMode, EvalGateResult } from './types.js';

export function resolveGateMode(override?: EvalGateMode): EvalGateMode {
  if (override) return override;
  const env = (process.env.CARINA_EVAL_GATE ?? 'off').toLowerCase();
  if (env === 'warn' || env === 'require' || env === 'bypass') return env;
  return 'off';
}

export async function runPackEvalGate(
  packName: string,
  options: { mode?: EvalGateMode; passes?: number } = {},
): Promise<EvalGateResult> {
  const mode = resolveGateMode(options.mode);

  if (mode === 'off' || mode === 'bypass') {
    return {
      mode,
      passed: true,
      blocked: false,
      message: mode === 'bypass' ? 'Eval gate bypassed' : 'Eval gate disabled',
    };
  }

  const evalPaths = await findEvalPathsForPack(packName);
  if (evalPaths.length === 0) {
    return {
      mode,
      passed: true,
      blocked: false,
      message: `No eval definition for pack "${packName}"; gate skipped`,
    };
  }

  try {
    const result = await runEval({
      packOrPath: packName,
      label: 'gate',
      passes: options.passes ?? 1,
    });
    const report = await saveReport(result);
    const passed = result.thresholdsMet && result.metrics.passRate >= (result.thresholds?.minPassRate ?? 0);

    if (!passed && mode === 'require') {
      return {
        mode,
        passed: false,
        blocked: true,
        message: `Eval gate failed for "${packName}": pass rate ${(result.metrics.passRate * 100).toFixed(1)}%`,
        runId: result.runId,
        reportPath: report.runId,
      };
    }

    if (!passed && mode === 'warn') {
      return {
        mode,
        passed: false,
        blocked: false,
        message: `Eval gate warning for "${packName}": pass rate ${(result.metrics.passRate * 100).toFixed(1)}%`,
        runId: result.runId,
        reportPath: report.runId,
      };
    }

    return {
      mode,
      passed: true,
      blocked: false,
      message: `Eval gate passed for "${packName}"`,
      runId: result.runId,
      reportPath: report.runId,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (mode === 'require') {
      return { mode, passed: false, blocked: true, message: `Eval gate error: ${msg}` };
    }
    return { mode, passed: false, blocked: false, message: `Eval gate warning: ${msg}` };
  }
}
